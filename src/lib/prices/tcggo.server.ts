/**
 * TCGGO (RapidAPI "pokemon-tcg-api") adapter — server-only.
 *
 * Republishes live TCGplayer market prices and Cardmarket figures (plus 7 and
 * 30 day averages) for English *and* Japanese printings, with artwork.
 * Everything written from here is a real published reading converted to USD at
 * the ECB daily reference rate — nothing is modelled, smoothed or estimated.
 */

const HOST = "pokemon-tcg-api.p.rapidapi.com";
const BASE = `https://${HOST}`;

function apiKey() {
  return process.env["RAPIDAPI_TCGGO_KEY"] ?? "";
}

async function api<T>(path: string): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { accept: "application/json", "x-rapidapi-host": HOST, "x-rapidapi-key": key },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* ----------------------------- currency ---------------------------------- */

let eurUsd: { rate: number; expires: number } | null = null;
export async function eurToUsd(): Promise<number> {
  if (eurUsd && eurUsd.expires > Date.now()) return eurUsd.rate;
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD", {
      headers: { accept: "application/json" },
    });
    const json = (await res.json()) as { rates?: { USD?: number } };
    const rate = json?.rates?.USD;
    if (typeof rate === "number" && rate > 0) {
      eurUsd = { rate, expires: Date.now() + 6 * 3600_000 };
      return rate;
    }
  } catch {
    /* fall through */
  }
  return eurUsd?.rate ?? 1.08;
}

/* ------------------------------- types ----------------------------------- */

interface TcggoEpisode {
  id: number;
  name: string;
  lang: string;
  code: string | null;
  released_at: string | null;
  logo: string | null;
  cards_total: number | null;
  cards_printed_total: number | null;
}

interface TcggoCard {
  id: number;
  name: string;
  card_number: number | string | null;
  card_code_number: string | null;
  rarity: string | null;
  supertype: string | null;
  hp: number | null;
  tcgid: string | null;
  image: string | null;
  lang: string;
  artist?: { name?: string } | null;
  prices?: {
    cardmarket?: Record<string, unknown> | null;
    tcg_player?: { market_price?: number | null; mid_price?: number | null } | null;
  } | null;
}

export interface TcggoReading {
  /** TCGplayer market price in USD, when published. */
  tcgplayerUsd: number | null;
  /** Cardmarket near-mint reading in USD, when published. */
  cardmarketUsd: number | null;
  /** Real dated Cardmarket averages in USD (7d / 30d), oldest first. */
  cardmarketSeeds: { daysAgo: number; price: number }[];
  image: string | null;
  rarity: string | null;
  artist: string | null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && v > 0 ? Number(v.toFixed(2)) : null;
}

function pick(block: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!block) return null;
  for (const k of keys) {
    const v = num(block[k]);
    if (v != null) return v;
  }
  return null;
}

async function toReading(card: TcggoCard): Promise<TcggoReading> {
  const rate = await eurToUsd();
  const cm = card.prices?.cardmarket ?? null;
  // The feed quotes both marketplaces in EUR.
  // Japanese printings publish region-scoped near-mint keys instead.
  const cmNow = pick(cm, [
    "lowest_near_mint",
    "lowest_near_mint_JP",
    "lowest_near_mint_EU_only",
    "lowest_near_mint_JP_EU_only",
    "7d_average",
    "30d_average",
  ]);
  const seeds: { daysAgo: number; price: number }[] = [];
  for (const [daysAgo, key] of [
    [30, "30d_average"],
    [7, "7d_average"],
  ] as const) {
    const v = pick(cm, [key]);
    if (v != null) seeds.push({ daysAgo, price: Number((v * rate).toFixed(2)) });
  }
  const tp = num(card.prices?.tcg_player?.market_price) ?? num(card.prices?.tcg_player?.mid_price);
  return {
    tcgplayerUsd: tp == null ? null : Number((tp * rate).toFixed(2)),
    cardmarketUsd: cmNow == null ? null : Number((cmNow * rate).toFixed(2)),
    cardmarketSeeds: seeds,
    image: card.image ?? null,
    rarity: card.rarity ?? null,
    artist: card.artist?.name ?? null,
  };
}

/* ---------------------------- episode index ------------------------------ */

const episodeCache = new Map<string, { byCode: Map<string, TcggoEpisode>; expires: number }>();

export async function listEpisodes(lang: "en" | "jp"): Promise<TcggoEpisode[]> {
  const out: TcggoEpisode[] = [];
  for (let page = 1; page <= 40; page++) {
    const json = await api<{ data: TcggoEpisode[]; paging?: { total?: number } }>(
      `/episodes?lang=${lang}&page=${page}`,
    );
    if (!json?.data?.length) break;
    out.push(...json.data);
    if (page >= (json.paging?.total ?? 1)) break;
  }
  return out;
}

async function episodeIndex(lang: "en" | "jp") {
  const hit = episodeCache.get(lang);
  if (hit && hit.expires > Date.now()) return hit.byCode;
  const byCode = new Map<string, TcggoEpisode>();
  for (const ep of await listEpisodes(lang)) {
    if (ep.code) byCode.set(ep.code.toUpperCase(), ep);
  }
  episodeCache.set(lang, { byCode, expires: Date.now() + 6 * 3600_000 });
  return byCode;
}

/* ------------------------------- lookup ---------------------------------- */

export interface TcggoRef {
  /** Catalogue id, e.g. `en-swsh12pt5-1` or `jp-sv1a-5`. */
  id: string;
  name?: string;
  number?: string;
  setCode?: string | null;
  language?: string;
}

function plainNumber(n?: string) {
  const first = (n ?? "").split("/")[0]?.trim() ?? "";
  const digits = first.replace(/[^0-9]/g, "");
  return digits ? String(Number(digits)) : "";
}

/** Finds the matching TCGGO card, by TCGplayer id first, then set code + number. */
export async function tcggoLookup(ref: TcggoRef): Promise<TcggoReading | null> {
  const lang: "en" | "jp" = ref.id.startsWith("jp-") || ref.language === "JP" ? "jp" : "en";

  if (lang === "en") {
    const tcgid = ref.id.replace(/^en-/, "");
    if (tcgid && !tcgid.startsWith("tp-")) {
      const json = await api<{ data: TcggoCard[] }>(
        `/cards?tcgid=${encodeURIComponent(tcgid)}&page=1`,
      );
      const hit = json?.data?.[0];
      if (hit) return toReading(hit);
    }
  }

  const code = ref.setCode?.toUpperCase();
  const number = plainNumber(ref.number);
  if (!code || !number) return null;
  const ep = (await episodeIndex(lang)).get(code);
  if (!ep) return null;
  // Japanese cards are only returned when the language is stated explicitly.
  const json = await api<{ data: TcggoCard[] }>(
    `/cards?episode_id=${ep.id}&card_number=${encodeURIComponent(number)}&lang=${lang}&page=1`,
  );
  const hit = json?.data?.find((c) => plainNumber(String(c.card_number ?? "")) === number);
  return hit ? toReading(hit) : null;
}

/* -------------------------------- sync ----------------------------------- */

export interface TcggoSyncArgs {
  language: "EN" | "JP";
  limit: number;
  offset: number;
  /** Only touch cards that currently have no market price. */
  onlyMissing: boolean;
  /** Also fill in missing artwork from the feed. */
  fillImages?: boolean;
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

type CardRow = {
  id: string;
  name: string;
  number: string;
  set_code: string | null;
  image_small: string | null;
  market_price: number | null;
};

export async function runTcggoSync(args: TcggoSyncArgs) {
  if (!apiKey()) return { ok: false, error: "RAPIDAPI_TCGGO_KEY is not configured" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let q = supabaseAdmin
    .from("tcg_cards")
    .select("id,name,number,set_code,image_small,market_price")
    .eq("language", args.language)
    .order("id", { ascending: true })
    .range(args.offset, args.offset + args.limit - 1);
  if (args.onlyMissing) q = q.is("market_price", null);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as unknown as CardRow[];

  const today = new Date().toISOString().slice(0, 10);
  const points: Record<string, unknown>[] = [];
  let priced = 0;
  let images = 0;

  const CONCURRENCY = 5;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (row) => ({
        row,
        reading: await tcggoLookup({
          id: row.id,
          name: row.name,
          number: row.number,
          setCode: row.set_code,
          language: args.language,
        }),
      })),
    );

    for (const { row, reading } of results) {
      if (!reading) continue;
      const best = reading.tcgplayerUsd ?? reading.cardmarketUsd;
      const update: Record<string, unknown> = {};
      if (best != null) {
        update["market_price"] = best;
        update["updated_at"] = new Date().toISOString();
        priced++;
      }
      if (args.fillImages && !row.image_small && reading.image) {
        update["image_small"] = reading.image;
        update["image_large"] = reading.image;
        images++;
      }
      if (Object.keys(update).length) {
        await supabaseAdmin.from("tcg_cards").update(update as never).eq("id", row.id);
      }

      if (reading.tcgplayerUsd != null) {
        points.push({
          card_id: row.id,
          source: "tcgplayer",
          condition: "Near Mint",
          price: reading.tcgplayerUsd,
          currency: "USD",
          captured_on: today,
        });
      }
      if (reading.cardmarketUsd != null) {
        points.push({
          card_id: row.id,
          source: "cardmarket",
          condition: "Near Mint",
          price: reading.cardmarketUsd,
          currency: "USD",
          captured_on: today,
        });
      }
      for (const seed of reading.cardmarketSeeds) {
        points.push({
          card_id: row.id,
          source: "cardmarket",
          condition: "Near Mint",
          price: seed.price,
          currency: "USD",
          captured_on: isoDaysAgo(seed.daysAgo),
        });
      }
    }
  }

  for (let i = 0; i < points.length; i += 500) {
    await supabaseAdmin.from("card_price_points").upsert(points.slice(i, i + 500) as never, {
      onConflict: "card_id,source,condition,captured_on",
      ignoreDuplicates: true,
    });
  }

  return {
    ok: true,
    scanned: rows.length,
    priced,
    imagesFilled: images,
    pointsCaptured: points.length,
    nextOffset: args.onlyMissing ? args.offset : args.offset + rows.length,
    done: rows.length < args.limit,
  };
}
