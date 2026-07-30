/**
 * Card catalogue ingestion (server-only).
 *
 * English cards + real TCGplayer market prices: Pokémon TCG API (api.pokemontcg.io)
 * Japanese cards (incl. promos): TCGdex (api.tcgdex.net)
 *
 * The sync is incremental and resumable: each invocation processes a limited
 * number of sets so it always finishes inside a request budget. Call it
 * repeatedly until `remainingSets` is 0.
 */

type Json = Record<string, any>;

const PTCG = "https://api.pokemontcg.io/v2";
const TCGDEX = "https://api.tcgdex.net/v2/ja";

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  const key = process.env.POKEMONTCG_API_KEY;
  if (key && url.startsWith(PTCG)) headers["X-Api-Key"] = key;
  const res = await fetch(url, { ...init, headers: { ...headers, ...init?.headers } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

function isoDate(v?: string | null) {
  if (!v) return null;
  const d = v.replaceAll("/", "-");
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function pickPrice(card: Json): number | null {
  const tp = card?.tcgplayer?.prices;
  if (tp) {
    const order = [
      "holofoil",
      "normal",
      "reverseHolofoil",
      "1stEditionHolofoil",
      "unlimitedHolofoil",
    ];
    for (const k of order) {
      const v = tp[k]?.market ?? tp[k]?.mid;
      if (typeof v === "number" && v > 0) return Number(v.toFixed(2));
    }
    const first = Object.values(tp)[0] as Json | undefined;
    const v = first?.market ?? first?.mid;
    if (typeof v === "number" && v > 0) return Number(v.toFixed(2));
  }
  const cm = card?.cardmarket?.prices;
  const v = cm?.trendPrice ?? cm?.averageSellPrice;
  return typeof v === "number" && v > 0 ? Number(v.toFixed(2)) : null;
}

export interface SetRow {
  id: string;
  language: "EN" | "JP";
  game: string;
  name: string;
  code: string | null;
  series: string | null;
  printed_total: number | null;
  total: number | null;
  release_date: string | null;
  logo_url: string | null;
  symbol_url: string | null;
}

/* ------------------------------- English -------------------------------- */

export async function fetchEnSets(): Promise<SetRow[]> {
  const out: SetRow[] = [];
  for (let page = 1; page <= 20; page++) {
    const json = await getJson<{ data: Json[] }>(`${PTCG}/sets?page=${page}&pageSize=250`);
    if (!json.data?.length) break;
    for (const s of json.data) {
      out.push({
        id: `en-${s.id}`,
        language: "EN",
        game: "pokemon",
        name: s.name,
        code: s.ptcgoCode ?? null,
        series: s.series ?? null,
        printed_total: s.printedTotal ?? null,
        total: s.total ?? null,
        release_date: isoDate(s.releaseDate),
        logo_url: s.images?.logo ?? null,
        symbol_url: s.images?.symbol ?? null,
      });
    }
    if (json.data.length < 250) break;
  }
  return out;
}

export async function fetchEnCards(set: SetRow) {
  const sourceId = set.id.replace(/^en-/, "");
  const rows: Json[] = [];
  for (let page = 1; page <= 20; page++) {
    const json = await getJson<{ data: Json[] }>(
      `${PTCG}/cards?q=set.id:"${sourceId}"&page=${page}&pageSize=250&orderBy=number`,
    );
    if (!json.data?.length) break;
    for (const c of json.data) {
      const promo =
        /promo/i.test(set.name) ||
        /promo/i.test(set.series ?? "") ||
        (c.rarity ?? "").toLowerCase().includes("promo");
      rows.push({
        id: `en-${c.id}`,
        language: "EN",
        game: "pokemon",
        name: c.name,
        native_name: null,
        set_id: set.id,
        set_name: set.name,
        set_code: set.code,
        number: String(c.number ?? ""),
        rarity: c.rarity ?? null,
        supertype: c.supertype ?? null,
        subtypes: c.subtypes ?? null,
        types: c.types ?? null,
        hp: c.hp ? Number(c.hp) || null : null,
        artist: c.artist ?? null,
        image_small: c.images?.small ?? null,
        image_large: c.images?.large ?? null,
        is_promo: promo,
        release_date: set.release_date,
        market_price: pickPrice(c),
        updated_at: new Date().toISOString(),
      });
    }
    if (json.data.length < 250) break;
  }
  return rows;
}

/* ------------------------------- Japanese ------------------------------- */

export async function fetchJpSets(): Promise<SetRow[]> {
  const brief = await getJson<Json[]>(`${TCGDEX}/sets`);
  return brief.map((s) => ({
    id: `jp-${s.id}`,
    language: "JP" as const,
    game: "pokemon",
    name: s.name,
    code: String(s.id).toUpperCase(),
    series: null,
    printed_total: s.cardCount?.official ?? null,
    total: s.cardCount?.total ?? null,
    release_date: null,
    logo_url: `https://assets.tcgdex.net/ja/logos/${s.id}.png`,
    symbol_url: null,
  }));
}

export async function fetchJpSetDetail(set: SetRow) {
  const sourceId = set.id.replace(/^jp-/, "");
  const detail = await getJson<Json>(`${TCGDEX}/sets/${sourceId}`);
  const releaseDate = isoDate(detail.releaseDate);
  const promoSet = /プロモ|promo/i.test(set.name) || /P$/i.test(sourceId);
  const rows = (detail.cards ?? []).map((c: Json) => ({
    id: `jp-${c.id}`,
    language: "JP",
    game: "pokemon",
    name: c.name,
    native_name: c.name,
    set_id: set.id,
    set_name: detail.name ?? set.name,
    set_code: set.code,
    number: String(c.localId ?? ""),
    rarity: c.rarity ?? null,
    supertype: null,
    subtypes: null,
    types: null,
    hp: null,
    artist: null,
    image_small: c.image ? `${c.image}/low.png` : null,
    image_large: c.image ? `${c.image}/high.png` : null,
    is_promo: promoSet,
    release_date: releaseDate,
    market_price: null,
    updated_at: new Date().toISOString(),
  }));
  return {
    set: {
      ...set,
      name: detail.name ?? set.name,
      series: detail.serie?.name ?? null,
      release_date: releaseDate,
      logo_url: detail.logo ? `${detail.logo}.png` : set.logo_url,
      symbol_url: detail.symbol ? `${detail.symbol}.png` : null,
      printed_total: detail.cardCount?.official ?? set.printed_total,
      total: detail.cardCount?.total ?? set.total,
    },
    cards: rows,
  };
}

/* -------------------------------- Runner -------------------------------- */

export interface SyncResult {
  language: "EN" | "JP";
  setsUpserted: number;
  cardsUpserted: number;
  processedSets: string[];
  remainingSets: number;
  done: boolean;
}

export async function runCatalogSync(opts: {
  language: "EN" | "JP";
  limit: number;
  force?: boolean;
}): Promise<SyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { language, limit } = opts;

  const sets = language === "EN" ? await fetchEnSets() : await fetchJpSets();

  // Upsert the set index first so the UI can browse sets immediately.
  for (let i = 0; i < sets.length; i += 200) {
    const { error } = await supabaseAdmin
      .from("tcg_sets")
      .upsert(sets.slice(i, i + 200), { onConflict: "id" });
    if (error) throw new Error(`set upsert failed: ${error.message}`);
  }

  // Work out which sets still need their cards ingested.
  const { data: counts, error: countErr } = await supabaseAdmin.rpc("set_card_counts", {
    lang: language,
  });
  if (countErr) throw new Error(`count lookup failed: ${countErr.message}`);
  const have = new Map<string, number>(
    ((counts ?? []) as { set_id: string; n: number }[]).map((r) => [r.set_id, Number(r.n)]),
  );

  // A set counts as ingested once it has any cards — some older sets expose
  // fewer cards than their printed total, which would otherwise loop forever.
  const pending = opts.force ? sets : sets.filter((s) => (have.get(s.id) ?? 0) === 0);

  const batch = pending.slice(0, limit);
  let cardsUpserted = 0;
  const processed: string[] = [];

  for (const set of batch) {
    try {
      let cards: Json[];
      if (language === "EN") {
        cards = await fetchEnCards(set);
      } else {
        const detail = await fetchJpSetDetail(set);
        await supabaseAdmin.from("tcg_sets").upsert([detail.set], { onConflict: "id" });
        cards = detail.cards;
      }
      for (let i = 0; i < cards.length; i += 400) {
        const { error } = await supabaseAdmin
          .from("tcg_cards")
          .upsert(cards.slice(i, i + 400) as never, { onConflict: "id" });
        if (error) throw new Error(error.message);
      }
      cardsUpserted += cards.length;
      processed.push(set.id);
    } catch (e) {
      console.error(`sync failed for ${set.id}`, e);
    }
  }

  return {
    language,
    setsUpserted: sets.length,
    cardsUpserted,
    processedSets: processed,
    remainingSets: Math.max(0, pending.length - batch.length),
    done: pending.length - batch.length <= 0,
  };
}
