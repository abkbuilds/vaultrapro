/**
 * Backfill for sets the primary catalogue sources don't cover (server-only).
 *
 * 1. Card backfill — some sets exist in `tcg_sets` but hold zero cards because
 *    the Pokémon TCG API (EN) / TCGdex (JP) hasn't published their card lists
 *    yet (e.g. the Mega Evolution era: Phantasmal Flames onwards). tcgcsv.com,
 *    the keyless mirror of the TCGplayer catalogue, lists every single with a
 *    real name, number, rarity, image and market price, so we ingest from there.
 *
 * 2. Release-date backfill — many Japanese sets carry no release date, which
 *    breaks chronological ordering in the UI. Dates come from TCGdex first
 *    (the official JP release date) and fall back to the TCGplayer group's
 *    published date.
 *
 * Nothing here is modelled or estimated: every value is copied from a source.
 * Both runs are incremental and resumable — call until `remaining` is 0.
 */

const TCGCSV = "https://tcgcsv.com/tcgplayer";
const TCGDEX_JA = "https://api.tcgdex.net/v2/ja";
const EN_CATEGORY = 3;
const JP_CATEGORY = 85;

interface Group {
  groupId: number;
  name: string;
  abbreviation: string | null;
  publishedOn: string | null;
}

interface Product {
  productId: number;
  name: string;
  cleanName: string;
  imageUrl: string | null;
  extendedData?: { name: string; value: string }[];
}

interface Price {
  productId: number;
  marketPrice: number | null;
  midPrice: number | null;
  lowPrice: number | null;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "curl/8.7.1" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

function ext(p: Product, key: string): string | null {
  return p.extendedData?.find((e) => e.name === key)?.value?.trim() || null;
}

/** "001/190" -> "001" */
function baseNumber(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split("/")[0].trim().split(/\s+/).pop() ?? "";
  return first || null;
}

/** "Mega Charizard X ex - 026/130" -> "Mega Charizard X ex" */
function cardName(p: Product): string {
  return p.name.split(" - ")[0].trim() || p.cleanName;
}

function image(p: Product, size: "200w" | "1000x1000"): string | null {
  if (!p.imageUrl) return null;
  return p.imageUrl.replace(/_\d+w\.jpg$/, `_${size}.jpg`);
}

function isoDate(v?: string | null): string | null {
  if (!v) return null;
  const d = String(v).slice(0, 10).replaceAll("/", "-");
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

async function listGroups(category: number): Promise<Group[]> {
  return (await getJson<{ results: Group[] }>(`${TCGCSV}/${category}/groups`)).results;
}

/* --------------------------- 1. card backfill ---------------------------- */

export interface CardBackfillResult {
  language: "EN" | "JP";
  setsProcessed: { set: string; cards: number }[];
  cardsInserted: number;
  remaining: number;
  done: boolean;
}

export async function runMissingCardBackfill(opts: {
  language?: "EN" | "JP";
  limit?: number;
}): Promise<CardBackfillResult> {
  const language = opts.language ?? "EN";
  const limit = opts.limit ?? 4;
  const category = language === "JP" ? JP_CATEGORY : EN_CATEGORY;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: setRows, error: setErr } = await supabaseAdmin
    .from("tcg_sets")
    .select("id,name,english_name,code,release_date")
    .eq("language", language);
  if (setErr) throw new Error(`set lookup failed: ${setErr.message}`);

  const sets = (setRows ?? []) as {
    id: string;
    name: string;
    english_name: string | null;
    code: string | null;
    release_date: string | null;
  }[];

  // Which of those sets currently hold no cards?
  const { data: counts, error: countErr } = await supabaseAdmin.rpc("set_card_counts", {
    lang: language,
  });
  if (countErr) throw new Error(`count lookup failed: ${countErr.message}`);
  const have = new Map<string, number>(
    ((counts ?? []) as { set_id: string; n: number }[]).map((r) => [r.set_id, Number(r.n)]),
  );

  const groups = await listGroups(category);
  const byAbbr = new Map<string, Group>();
  for (const g of groups) if (g.abbreviation) byAbbr.set(g.abbreviation.toUpperCase(), g);

  const empty = sets.filter((s) => (have.get(s.id) ?? 0) === 0);
  const pending = empty
    .map((s) => ({
      set: s,
      group:
        byAbbr.get((s.code ?? "").toUpperCase()) ??
        byAbbr.get(s.id.replace(/^(en|jp)-/, "").toUpperCase()),
    }))
    .filter((x): x is { set: (typeof empty)[number]; group: Group } => Boolean(x.group));

  const batch = pending.slice(0, limit);
  let cardsInserted = 0;
  const processed: { set: string; cards: number }[] = [];

  for (const { set, group } of batch) {
    try {
      const [products, prices] = await Promise.all([
        getJson<{ results: Product[] }>(`${TCGCSV}/${category}/${group.groupId}/products`),
        getJson<{ results: Price[] }>(`${TCGCSV}/${category}/${group.groupId}/prices`).catch(
          () => ({ results: [] as Price[] }),
        ),
      ]);

      const priceOf = new Map<number, number>();
      for (const p of prices.results) {
        const v = p.marketPrice ?? p.midPrice ?? p.lowPrice;
        if (typeof v === "number" && v > 0) {
          const prev = priceOf.get(p.productId);
          if (prev == null || v > prev) priceOf.set(p.productId, Number(v.toFixed(2)));
        }
      }

      const release = set.release_date ?? isoDate(group.publishedOn);
      const promo = /promo/i.test(set.name) || /promo/i.test(group.name);
      const prefix = language === "JP" ? "jp" : "en";
      const seen = new Set<string>();
      const rows: Record<string, unknown>[] = [];

      for (const p of products.results) {
        const number = baseNumber(ext(p, "Number"));
        if (!number) continue; // sealed product, not a single
        const id = `${prefix}-${set.id.replace(/^(en|jp)-/, "")}-${number}`.toLowerCase();
        if (seen.has(id)) continue;
        seen.add(id);
        const name = cardName(p);
        const hp = Number(ext(p, "HP") ?? "");
        rows.push({
          id,
          language,
          game: "pokemon",
          name,
          native_name: null,
          english_name: name,
          set_id: set.id,
          set_name: set.name,
          english_set_name: set.english_name ?? set.name,
          set_code: set.code,
          number,
          rarity: ext(p, "Rarity"),
          supertype: ext(p, "CardType"),
          subtypes: null,
          types: null,
          hp: Number.isFinite(hp) && hp > 0 ? hp : null,
          artist: null,
          image_small: image(p, "200w"),
          image_large: image(p, "1000x1000"),
          is_promo: promo,
          release_date: release,
          market_price: priceOf.get(p.productId) ?? null,
          updated_at: new Date().toISOString(),
        });
      }

      for (let i = 0; i < rows.length; i += 400) {
        const { error } = await supabaseAdmin
          .from("tcg_cards")
          .upsert(rows.slice(i, i + 400) as never, { onConflict: "id" });
        if (error) throw new Error(error.message);
      }

      if (release && !set.release_date) {
        await supabaseAdmin
          .from("tcg_sets")
          .update({ release_date: release } as never)
          .eq("id", set.id);
      }

      cardsInserted += rows.length;
      processed.push({ set: set.id, cards: rows.length });
    } catch (e) {
      console.error(`card backfill failed for ${set.id}`, e);
      processed.push({ set: set.id, cards: 0 });
    }
  }

  const remaining = Math.max(0, pending.length - batch.length);
  return { language, setsProcessed: processed, cardsInserted, remaining, done: remaining === 0 };
}

/* ----------------------- 2. release-date backfill ------------------------ */

export interface DateBackfillResult {
  language: "EN" | "JP";
  setsDated: { set: string; date: string }[];
  remaining: number;
  done: boolean;
}

export async function runReleaseDateBackfill(opts: {
  language?: "EN" | "JP";
  limit?: number;
}): Promise<DateBackfillResult> {
  const language = opts.language ?? "JP";
  const limit = opts.limit ?? 30;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("tcg_sets")
    .select("id,code")
    .eq("language", language)
    .is("release_date", null);
  if (error) throw new Error(`set lookup failed: ${error.message}`);
  const missing = (data ?? []) as { id: string; code: string | null }[];

  const groups = await listGroups(language === "JP" ? JP_CATEGORY : EN_CATEGORY);
  const byAbbr = new Map<string, Group>();
  for (const g of groups) if (g.abbreviation) byAbbr.set(g.abbreviation.toUpperCase(), g);

  const batch = missing.slice(0, limit);
  const dated: { set: string; date: string }[] = [];

  for (const set of batch) {
    const sourceId = set.id.replace(/^(en|jp)-/, "");
    let date: string | null = null;

    if (language === "JP") {
      try {
        const detail = await getJson<{ releaseDate?: string }>(`${TCGDEX_JA}/sets/${sourceId}`);
        date = isoDate(detail.releaseDate);
      } catch {
        date = null;
      }
    }

    if (!date) {
      const group =
        byAbbr.get((set.code ?? "").toUpperCase()) ?? byAbbr.get(sourceId.toUpperCase());
      date = isoDate(group?.publishedOn ?? null);
    }

    if (!date) continue;
    await supabaseAdmin
      .from("tcg_sets")
      .update({ release_date: date } as never)
      .eq("id", set.id);
    await supabaseAdmin
      .from("tcg_cards")
      .update({ release_date: date } as never)
      .eq("set_id", set.id)
      .is("release_date", null);
    dated.push({ set: set.id, date });
  }

  const remaining = Math.max(0, missing.length - batch.length);
  return { language, setsDated: dated, remaining, done: remaining === 0 };
}
