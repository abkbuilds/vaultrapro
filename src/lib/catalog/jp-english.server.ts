/**
 * Japanese catalogue enrichment (server-only).
 *
 * Source: tcgcsv.com — a free, publicly accessible mirror of the TCGplayer
 * catalogue (category 85 = "Pokemon Japan"). It provides, for every Japanese
 * set including every promo series:
 *   - the English set name and abbreviation (e.g. "S4a: Shiny Star V")
 *   - the English card name and English-format set number ("001/190")
 *   - a real TCGplayer market price per product
 *
 * We use it for three things:
 *   1. English names on Japanese cards so users can search JP cards in English
 *   2. Backfilling Japanese sets that TCGdex exposes with an empty card list
 *   3. Real market prices for Japanese cards
 *
 * The sync is incremental and resumable: each call processes a limited number
 * of sets. Call repeatedly until `remainingSets` is 0.
 */

const BASE = "https://tcgcsv.com/tcgplayer/85";

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

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "curl/8.7.1",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

function ext(p: Product, key: string): string | null {
  return p.extendedData?.find((e) => e.name === key)?.value?.trim() || null;
}

/** "001/190" -> "001"; "SV-P 001" -> "001"; "TG05/TG30" -> "TG05" */
export function baseNumber(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split("/")[0].trim().split(/\s+/).pop() ?? "";
  return first || null;
}

/** Loose key so "001" and "1" match. */
export function numberKey(n: string | null | undefined): string {
  if (!n) return "";
  const s = n.trim().toUpperCase();
  const m = s.match(/^([A-Z]*)0*(\d+)([A-Z]*)$/);
  return m ? `${m[1]}${m[2]}${m[3]}` : s;
}

/** "Rowlet - 001/190" -> "Rowlet"; keeps suffixes like "Umbreon VMAX". */
export function englishCardName(product: Product): string {
  return product.name.split(" - ")[0].trim() || product.cleanName;
}

/** "S4a: Shiny Star V" -> "Shiny Star V" */
export function englishSetName(group: Group): string {
  const idx = group.name.indexOf(":");
  return (idx > -1 ? group.name.slice(idx + 1) : group.name).trim();
}

function isSingle(p: Product): boolean {
  return Boolean(ext(p, "Number"));
}

function imageUrl(p: Product, size: "200w" | "400w"): string | null {
  if (!p.imageUrl) return null;
  return p.imageUrl.replace(/_\d+w\.jpg$/, `_${size}.jpg`);
}

export interface JpEnrichResult {
  setsSeen: number;
  setsProcessed: string[];
  cardsUpdated: number;
  cardsInserted: number;
  remainingSets: number;
  done: boolean;
}

export async function runJpEnglishSync(opts: {
  limit?: number;
  force?: boolean;
}): Promise<JpEnrichResult> {
  const limit = opts.limit ?? 4;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const groups = (await getJson<{ results: Group[] }>(`${BASE}/groups`)).results.filter(
    (g) => g.abbreviation,
  );

  // Existing JP sets keyed by upper-cased TCGdex id (jp-S4a -> "S4A").
  const { data: setRows, error: setErr } = await supabaseAdmin
    .from("tcg_sets")
    .select("id,name,english_name")
    .eq("language", "JP");
  if (setErr) throw new Error(`set lookup failed: ${setErr.message}`);
  const setByAbbr = new Map<
    string,
    { id: string; name: string; english_name: string | null }
  >((setRows ?? []).map((s) => [s.id.replace(/^jp-/, "").toUpperCase(), s as never]));

  // A set is considered enriched once it carries an English name.
  const pending = opts.force
    ? groups
    : groups.filter((g) => !setByAbbr.get((g.abbreviation ?? "").toUpperCase())?.english_name);

  const batch = pending.slice(0, limit);
  let cardsUpdated = 0;
  let cardsInserted = 0;
  const processed: string[] = [];

  for (const group of batch) {
    const abbr = (group.abbreviation ?? "").toUpperCase();
    try {
      const [products, prices] = await Promise.all([
        getJson<{ results: Product[] }>(`${BASE}/${group.groupId}/products`),
        getJson<{ results: { productId: number; marketPrice: number | null }[] }>(
          `${BASE}/${group.groupId}/prices`,
        ).catch(() => ({ results: [] })),
      ]);
      const priceOf = new Map<number, number>();
      for (const p of prices.results) {
        if (typeof p.marketPrice === "number" && p.marketPrice > 0)
          priceOf.set(p.productId, Number(p.marketPrice.toFixed(2)));
      }

      const singles = products.results.filter(isSingle);
      const enName = englishSetName(group);
      const releaseDate = group.publishedOn ? group.publishedOn.slice(0, 10) : null;
      const existing = setByAbbr.get(abbr);
      const setId = existing?.id ?? `jp-${abbr}`;
      const isPromo = /promo|-P$|^SP/i.test(abbr) || /promo/i.test(enName);

      if (!existing) {
        await supabaseAdmin.from("tcg_sets").upsert(
          [
            {
              id: setId,
              language: "JP",
              game: "pokemon",
              name: enName,
              english_name: enName,
              code: abbr,
              release_date: releaseDate,
            },
          ],
          { onConflict: "id" },
        );
        setByAbbr.set(abbr, { id: setId, name: enName, english_name: enName });
      } else {
        await supabaseAdmin
          .from("tcg_sets")
          .update({ english_name: enName, code: abbr })
          .eq("id", setId);
      }

      if (!singles.length) {
        // Sealed-product-only group (e.g. a set with no singles listed yet).
        processed.push(abbr);
        continue;
      }

      // Existing cards in this set, keyed by loose number (paged: the Data API
      // caps a single response at 1000 rows).
      const cardRows: { id: string; number: string }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await supabaseAdmin
          .from("tcg_cards")
          .select("id,number")
          .eq("set_id", setId)
          .range(from, from + 999);
        const page = (data ?? []) as { id: string; number: string }[];
        cardRows.push(...page);
        if (page.length < 1000) break;
      }
      const byNumber = new Map<string, { id: string }>(
        cardRows.map((c) => [numberKey(c.number), c]),
      );

      const updates: Record<string, unknown>[] = [];
      const inserts: Record<string, unknown>[] = [];
      const setName = existing?.name ?? enName;

      for (const p of singles) {
        const num = baseNumber(ext(p, "Number"));
        if (!num) continue;
        const key = numberKey(num);
        const name = englishCardName(p);
        const price = priceOf.get(p.productId) ?? null;
        const hit = byNumber.get(key);
        if (hit) {
          updates.push({
            id: hit.id,
            english_name: name,
            english_set_name: enName,
            ...(price != null ? { market_price: price } : {}),
            updated_at: new Date().toISOString(),
          });
        } else {
          const hp = Number(ext(p, "HP"));
          inserts.push({
            id: `jp-tp-${p.productId}`,
            language: "JP",
            game: "pokemon",
            name,
            english_name: name,
            native_name: null,
            set_id: setId,
            set_name: setName,
            english_set_name: enName,
            set_code: abbr,
            number: num,
            rarity: ext(p, "Rarity") === "None" ? null : ext(p, "Rarity"),
            supertype: ext(p, "Card Type") ? "Pokémon" : null,
            types: ext(p, "CardType") ? [ext(p, "CardType") as string] : null,
            hp: Number.isFinite(hp) && hp > 0 ? hp : null,
            image_small: imageUrl(p, "200w"),
            image_large: imageUrl(p, "400w"),
            is_promo: isPromo,
            release_date: releaseDate,
            market_price: price,
            updated_at: new Date().toISOString(),
          });
        }
      }

      for (let i = 0; i < updates.length; i += 300) {
        const chunk = updates.slice(i, i + 300);
        await Promise.all(
          chunk.map((u) => {
            const { id, ...rest } = u as { id: string };
            return supabaseAdmin
              .from("tcg_cards")
              .update(rest as never)
              .eq("id", id);
          }),
        );
        cardsUpdated += chunk.length;
      }
      for (let i = 0; i < inserts.length; i += 300) {
        const { error } = await supabaseAdmin
          .from("tcg_cards")
          .upsert(inserts.slice(i, i + 300) as never, { onConflict: "id" });
        if (error) throw new Error(error.message);
        cardsInserted += Math.min(300, inserts.length - i);
      }
      processed.push(abbr);
    } catch (e) {
      console.error(`jp english sync failed for ${abbr}`, e);
    }
  }

  return {
    setsSeen: groups.length,
    setsProcessed: processed,
    cardsUpdated,
    cardsInserted,
    remainingSets: Math.max(0, pending.length - batch.length),
    done: pending.length - batch.length <= 0,
  };
}
