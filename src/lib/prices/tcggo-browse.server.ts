/**
 * TCGGO (RapidAPI "pokemon-tcg-api") browse + sold-price adapters — server only.
 *
 * Every request goes through the shared metered `tcggoApi` helper, so these
 * endpoints draw from the same daily ledger (hard cap 14,800 of the 15,000
 * plan limit) as the price sync. Nothing here is modelled or estimated: each
 * figure is a published reading, a real eBay sold listing, or a dated market
 * close from the feed's own history series.
 */

import { tcggoApi, tcggoFindCard, type TcggoCard } from "./tcggo.server";
import {
  blockCurrency,
  cardmarketNearMint,
  cardmarketProductLow,
} from "./tcggo-figures";

/* ------------------------------ currency --------------------------------- */

const rates = new Map<string, { rate: number; expires: number }>();

/** ECB daily reference rate, cached 6h. Returns null when unavailable. */
export async function toUsd(amount: number, currency: string): Promise<number | null> {
  const cur = (currency || "USD").toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (cur === "USD") return Number(amount.toFixed(2));
  const hit = rates.get(cur);
  if (hit && hit.expires > Date.now()) return Number((amount * hit.rate).toFixed(2));
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${cur}&to=USD`, {
      headers: { accept: "application/json" },
    });
    const json = (await res.json()) as { rates?: { USD?: number } };
    const rate = json?.rates?.USD;
    if (typeof rate === "number" && rate > 0) {
      rates.set(cur, { rate, expires: Date.now() + 6 * 3600_000 });
      return Number((amount * rate).toFixed(2));
    }
  } catch {
    /* no rate, no conversion */
  }
  return hit ? Number((amount * hit.rate).toFixed(2)) : null;
}

/* -------------------------------- types ---------------------------------- */

export interface TcggoPaging {
  current: number;
  total: number;
  perPage: number;
  results: number;
}

export interface TcggoListResult<T> {
  data: T[];
  paging: TcggoPaging;
}

export interface TcggoArtist {
  id: number;
  name: string;
  slug: string;
  cardsTotal?: number | null;
}

export interface TcggoProduct {
  id: number;
  name: string;
  slug: string;
  lang: string;
  image: string | null;
  episode: string | null;
  releasedAt: string | null;
  /** Lowest published Cardmarket asking price, converted to USD. */
  priceUsd: number | null;
  url: string | null;
}

export interface TcggoCardSummary {
  id: number;
  name: string;
  number: string | null;
  rarity: string | null;
  image: string | null;
  lang: string;
  episode: string | null;
  tcgid: string | null;
  artist: string | null;
  /** Published TCGplayer market price (USD) when available, else Cardmarket. */
  priceUsd: number | null;
  priceSource: "tcgplayer" | "cardmarket" | null;
}

export interface TcggoGradedPrice {
  company: string;
  grade: string;
  medianPrice: number;
  sampleSize: number;
}

export interface TcggoSoldOffer {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  priceUsd: number | null;
  company: string | null;
  grade: string | null;
  imageUrl: string | null;
  url: string | null;
  endedAt: string | null;
}

export interface TcggoHistoryPoint {
  date: string;
  tcgplayerUsd: number | null;
  cardmarketUsd: number | null;
}

/* ------------------------------- helpers --------------------------------- */

function paging(raw: unknown, fallbackCount: number): TcggoPaging {
  const p = (raw ?? {}) as { current?: number; total?: number; per_page?: number };
  return {
    current: Number(p.current ?? 1),
    total: Number(p.total ?? 1),
    perPage: Number(p.per_page ?? fallbackCount),
    results: fallbackCount,
  };
}

function money(v: unknown): number | null {
  return typeof v === "number" && v > 0 ? Number(v.toFixed(2)) : null;
}

type RawPrices = {
  cardmarket?: Record<string, unknown> | null;
  tcg_player?: { market_price?: number | null; mid_price?: number | null } | null;
};

async function cardSummary(raw: TcggoCard & { episode?: { name?: string } | null }) {
  const prices = (raw.prices ?? null) as RawPrices | null;
  const cm = prices?.cardmarket ?? null;
  const tp = money(prices?.tcg_player?.market_price) ?? money(prices?.tcg_player?.mid_price);
  const cmLow = cm
    ? (money(cm["lowest_near_mint"]) ??
      money(cm["lowest_near_mint_JP"]) ??
      money(cm["lowest_near_mint_EU_only"]) ??
      money(cm["7d_average"]))
    : null;
  const priceUsd = tp != null ? await toUsd(tp, "EUR") : cmLow != null ? await toUsd(cmLow, "EUR") : null;
  const summary: TcggoCardSummary = {
    id: raw.id,
    name: raw.name,
    number: raw.card_number == null ? null : String(raw.card_number),
    rarity: raw.rarity ?? null,
    image: raw.image ?? null,
    lang: raw.lang,
    episode: raw.episode?.name ?? null,
    tcgid: raw.tcgid ?? null,
    artist: raw.artist?.name ?? null,
    priceUsd,
    priceSource: priceUsd == null ? null : tp != null ? "tcgplayer" : "cardmarket",
  };
  return summary;
}

async function mapCards(rows: unknown[]): Promise<TcggoCardSummary[]> {
  return Promise.all(rows.map((r) => cardSummary(r as TcggoCard)));
}

function query(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  return qs.toString();
}

const EMPTY: TcggoPaging = { current: 1, total: 1, perPage: 0, results: 0 };

/* -------------------------------- cards ---------------------------------- */

/** List cards, optionally filtered by a free-text search. */
export async function tcggoListCards(opts: {
  page?: number;
  perPage?: number;
  sort?: string;
  search?: string;
  lang?: "en" | "jp";
}): Promise<TcggoListResult<TcggoCardSummary>> {
  const json = await tcggoApi<{ data: unknown[]; paging?: unknown }>(
    `/cards?${query({
      page: opts.page ?? 1,
      per_page: opts.perPage ?? 20,
      sort: opts.sort ?? "relevance",
      search: opts.search,
      lang: opts.lang,
    })}`,
  );
  if (!json?.data) return { data: [], paging: EMPTY };
  return { data: await mapCards(json.data), paging: paging(json.paging, json.data.length) };
}

/** List every card in one expansion (episode). */
export async function tcggoEpisodeCards(
  episodeId: number,
  opts: { page?: number; perPage?: number; sort?: string } = {},
): Promise<TcggoListResult<TcggoCardSummary>> {
  const json = await tcggoApi<{ data: unknown[]; paging?: unknown }>(
    `/episodes/${episodeId}/cards?${query({
      page: opts.page ?? 1,
      per_page: opts.perPage ?? 20,
      sort: opts.sort ?? "card_number_lowest",
    })}`,
  );
  if (!json?.data) return { data: [], paging: EMPTY };
  return { data: await mapCards(json.data), paging: paging(json.paging, json.data.length) };
}

/** Full detail for one TCGGO card id. */
export async function tcggoCardDetail(id: number) {
  const json = await tcggoApi<{ data: TcggoCard }>(`/cards/${id}`);
  if (!json?.data) return null;
  const raw = json.data as TcggoCard & { prices?: Record<string, unknown> };
  const summary = await cardSummary(raw);
  const ebay = (raw.prices as { ebay?: unknown } | undefined)?.ebay as
    | { currency?: string; graded?: Record<string, Record<string, { median_price?: number; sample_size?: number }>> }
    | undefined;
  const graded: TcggoGradedPrice[] = [];
  for (const [company, grades] of Object.entries(ebay?.graded ?? {})) {
    for (const [grade, entry] of Object.entries(grades ?? {})) {
      const price = money(entry?.median_price);
      if (price == null) continue;
      graded.push({
        company: company.toUpperCase(),
        grade,
        medianPrice: price,
        sampleSize: Number(entry?.sample_size ?? 0),
      });
    }
  }
  return { ...summary, graded };
}

/* ------------------------------- artists --------------------------------- */

export async function tcggoListArtists(page = 1): Promise<TcggoListResult<TcggoArtist>> {
  const json = await tcggoApi<{ data: TcggoArtist[]; paging?: unknown }>(`/artists?page=${page}`);
  if (!json?.data) return { data: [], paging: EMPTY };
  return { data: json.data, paging: paging(json.paging, json.data.length) };
}

export async function tcggoArtistDetail(id: number): Promise<TcggoArtist | null> {
  const json = await tcggoApi<{ data: TcggoArtist }>(`/artists/${id}`);
  return json?.data ?? null;
}

export async function tcggoArtistCards(
  id: number,
  opts: { page?: number; sort?: string } = {},
): Promise<TcggoListResult<TcggoCardSummary>> {
  const json = await tcggoApi<{ data: unknown[]; paging?: unknown }>(
    `/artists/${id}/cards?${query({ page: opts.page ?? 1, sort: opts.sort ?? "price_highest" })}`,
  );
  if (!json?.data) return { data: [], paging: EMPTY };
  return { data: await mapCards(json.data), paging: paging(json.paging, json.data.length) };
}

/* ------------------------------- products -------------------------------- */

type RawProduct = {
  id: number;
  name: string;
  slug: string;
  lang: string;
  image?: string | null;
  tcggo_url?: string | null;
  prices?: { cardmarket?: Record<string, unknown> | null } | null;
  episode?: { name?: string | null; released_at?: string | null } | null;
};

async function productSummary(raw: RawProduct): Promise<TcggoProduct> {
  const cm = raw.prices?.cardmarket ?? null;
  const low = cm ? (money(cm["lowest"]) ?? money(cm["lowest_EU_only"]) ?? money(cm["7d_average"])) : null;
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    lang: raw.lang,
    image: raw.image ?? null,
    episode: raw.episode?.name ?? null,
    releasedAt: raw.episode?.released_at ?? null,
    priceUsd: low == null ? null : await toUsd(low, String(cm?.["currency"] ?? "EUR")),
    url: raw.tcggo_url ?? null,
  };
}

export async function tcggoListProducts(
  opts: { page?: number; sort?: string; search?: string; lang?: "en" | "jp" } = {},
): Promise<TcggoListResult<TcggoProduct>> {
  const json = await tcggoApi<{ data: RawProduct[]; paging?: unknown }>(
    `/products?${query({
      page: opts.page ?? 1,
      sort: opts.sort ?? "relevance",
      search: opts.search,
      lang: opts.lang,
    })}`,
  );
  if (!json?.data) return { data: [], paging: EMPTY };
  return {
    data: await Promise.all(json.data.map(productSummary)),
    paging: paging(json.paging, json.data.length),
  };
}

export async function tcggoEpisodeProducts(
  episodeId: number,
  opts: { page?: number; sort?: string } = {},
): Promise<TcggoListResult<TcggoProduct>> {
  const json = await tcggoApi<{ data: RawProduct[]; paging?: unknown }>(
    `/episodes/${episodeId}/products?${query({ page: opts.page ?? 1, sort: opts.sort ?? "relevance" })}`,
  );
  if (!json?.data) return { data: [], paging: EMPTY };
  return {
    data: await Promise.all(json.data.map(productSummary)),
    paging: paging(json.paging, json.data.length),
  };
}

export async function tcggoProductDetail(id: number): Promise<TcggoProduct | null> {
  const json = await tcggoApi<{ data: RawProduct }>(`/products/${id}`);
  return json?.data ? productSummary(json.data) : null;
}

/* --------------------------- sold prices & history ------------------------ */

/** Median eBay sold prices per grading company + grade, for a TCGGO card id. */
export async function tcggoGradedSoldPrices(id: number): Promise<TcggoGradedPrice[]> {
  const json = await tcggoApi<{
    data: { company?: string; grade?: string; median_price?: number; sample_size?: number }[];
  }>(`/ebay-sold-prices?id=${id}`);
  const out: TcggoGradedPrice[] = [];
  for (const row of json?.data ?? []) {
    const price = money(row.median_price);
    if (price == null) continue;
    out.push({
      company: String(row.company ?? "").toUpperCase(),
      grade: String(row.grade ?? ""),
      medianPrice: price,
      sampleSize: Number(row.sample_size ?? 0),
    });
  }
  return out;
}

/** Individual completed eBay sales for a TCGGO card id. */
export async function tcggoSoldOffers(
  id: number,
  opts: { page?: number; perPage?: number } = {},
): Promise<TcggoSoldOffer[]> {
  const json = await tcggoApi<{
    data: {
      ebay_item_id?: string;
      title?: string;
      price?: number;
      currency?: string;
      company?: string | null;
      grade?: string | null;
      image_url?: string | null;
      url?: string | null;
      ended_at?: string | null;
    }[];
  }>(`/ebay-sold-offers?${query({ id, page: opts.page ?? 1, per_page: opts.perPage ?? 20 })}`);
  const out: TcggoSoldOffer[] = [];
  for (const row of json?.data ?? []) {
    const price = money(row.price);
    if (price == null || !row.ebay_item_id) continue;
    out.push({
      itemId: String(row.ebay_item_id),
      title: row.title ?? "",
      price,
      currency: (row.currency ?? "USD").toUpperCase(),
      priceUsd: await toUsd(price, row.currency ?? "USD"),
      company: row.company ?? null,
      grade: row.grade ?? null,
      imageUrl: row.image_url ?? null,
      url: row.url ?? null,
      endedAt: row.ended_at ?? null,
    });
  }
  return out;
}

/** Dated daily market closes published by the feed, converted to USD. */
export async function tcggoHistoryPrices(
  id: number,
  lang: "en" | "jp" = "en",
): Promise<TcggoHistoryPoint[]> {
  const json = await tcggoApi<{ data: Record<string, { cm_low?: number | null; tcg_player_market?: number | null }> }>(
    `/history-prices?${query({ id, lang, sort: "asc", page: 1 })}`,
  );
  const rows = json?.data ?? null;
  if (!rows || typeof rows !== "object") return [];
  const out: TcggoHistoryPoint[] = [];
  for (const [date, entry] of Object.entries(rows)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const tp = money(entry?.tcg_player_market);
    const cm = money(entry?.cm_low);
    out.push({
      date,
      tcgplayerUsd: tp == null ? null : await toUsd(tp, "USD"),
      cardmarketUsd: cm == null ? null : await toUsd(cm, "EUR"),
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/* ------------------------- catalogue-card bridge -------------------------- */

/** Resolves one of our catalogue ids to the feed's numeric card id. */
export async function tcggoIdFor(ref: {
  id: string;
  name?: string;
  number?: string;
  setCode?: string | null;
  language?: string;
}): Promise<number | null> {
  const hit = await tcggoFindCard(ref);
  return hit?.id ?? null;
}

/**
 * Imports the feed's dated market history and completed eBay sales for one
 * catalogue card. Only real published readings are written.
 */
export async function importTcggoHistory(cardRef: {
  id: string;
  name?: string;
  number?: string;
  setCode?: string | null;
  language?: string;
}) {
  const feedId = await tcggoIdFor(cardRef);
  if (!feedId) return { ok: false as const, reason: "not-published" as const };
  const lang: "en" | "jp" = cardRef.language === "JP" ? "jp" : "en";
  const [history, offers] = await Promise.all([
    tcggoHistoryPrices(feedId, lang),
    tcggoSoldOffers(feedId, { perPage: 50 }),
  ]);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const points: Record<string, unknown>[] = [];
  for (const point of history) {
    if (point.tcgplayerUsd != null) {
      points.push({
        card_id: cardRef.id,
        source: "tcgplayer",
        condition: "Near Mint",
        price: point.tcgplayerUsd,
        currency: "USD",
        captured_on: point.date,
      });
    }
    if (point.cardmarketUsd != null) {
      points.push({
        card_id: cardRef.id,
        source: "cardmarket",
        condition: "Near Mint",
        price: point.cardmarketUsd,
        currency: "USD",
        captured_on: point.date,
      });
    }
  }
  for (let i = 0; i < points.length; i += 500) {
    await supabaseAdmin.from("card_price_points").upsert(points.slice(i, i + 500) as never, {
      onConflict: "card_id,source,condition,captured_on",
      ignoreDuplicates: true,
    });
  }

  const sales = offers
    .filter((o) => o.endedAt && o.priceUsd != null)
    .map((o) => ({
      card_id: cardRef.id,
      source: "ebay",
      external_id: `tcggo-ebay-${o.itemId}`,
      title: o.title,
      url: o.url,
      price: o.price,
      currency: o.currency,
      price_usd: o.priceUsd,
      condition: o.grade ? `${o.company ?? "Graded"} ${o.grade}` : null,
      sold_at: o.endedAt,
    }));
  if (sales.length) {
    await supabaseAdmin
      .from("card_sales")
      .upsert(sales as never, { onConflict: "source,external_id", ignoreDuplicates: true });
  }

  return { ok: true as const, feedId, pricePoints: points.length, sales: sales.length };
}
