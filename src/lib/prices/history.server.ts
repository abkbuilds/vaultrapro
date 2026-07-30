/**
 * Price history assembly (server-only).
 *
 * Every number returned here comes from a real, source-backed reading:
 * live marketplace quotes, or readings captured into `card_price_points`
 * by the snapshot endpoint. Nothing is modelled, smoothed or interpolated —
 * when a source has no data, it is simply absent and the UI says "no data".
 */
import { supabase } from "@/integrations/supabase/client";
import type { PriceSource, TimeRange } from "@/lib/tcg/types";
import { RANGE_DAYS } from "@/lib/tcg/types";
import {
  cardmarketHistorySeeds,
  quoteAll,
  sourcesFor,
  type Quote,
} from "./sources.server";

export interface SeriesBySource {
  source: PriceSource;
  currency: string;
  live: boolean;
  note?: string;
  points: { date: string; value: number }[];
}

export interface CardPricePayload {
  cardId: string;
  range: TimeRange;
  fetchedAt: string;
  series: SeriesBySource[];
  quotes: Quote[];
}

export interface CardLike {
  id: string;
  name: string;
  number: string;
  setName: string;
  language: string;
  marketPrice: number;
}

export async function getCardPrices(
  card: CardLike,
  range: TimeRange,
): Promise<CardPricePayload> {
  const [quotes, stored] = await Promise.all([
    quoteAll(card),
    loadStored(card.id, RANGE_DAYS[range]),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  const series: SeriesBySource[] = sourcesFor(card.language).flatMap(
    (source): SeriesBySource[] => {
      const quote = quotes.find((q) => q.source === source);
      const points = [...(stored.get(source) ?? [])];

      // A live quote is a real observation for right now, so it belongs on the
      // chart — but only once per day, replacing today's captured reading.
      if (quote?.price != null) {
        const withoutToday = points.filter((p) => p.date.slice(0, 10) !== today);
        withoutToday.push({ date: new Date().toISOString(), value: quote.price });
        points.length = 0;
        points.push(...withoutToday);
      }

      // No captured history and no live quote: charting anything would be
      // invented data, so the source is reported as unavailable instead.
      if (!points.length) return [];

      points.sort((a, b) => a.date.localeCompare(b.date));
      return [
        {
          source,
          currency: quote?.currency ?? "USD",
          live: Boolean(quote?.price != null),
          note: quote?.note,
          points,
        },
      ];
    },
  );

  return {
    cardId: card.id,
    range,
    fetchedAt: new Date().toISOString(),
    series,
    quotes,
  };
}

async function loadStored(cardId: string, days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data } = await supabase
    .from("card_price_points")
    .select("source,price,captured_on")
    .eq("card_id", cardId)
    .gte("captured_on", since.toISOString().slice(0, 10))
    .order("captured_on", { ascending: true })
    .limit(5000);

  const map = new Map<PriceSource, { date: string; value: number }[]>();
  for (const row of (data ?? []) as { source: string; price: number; captured_on: string }[]) {
    const key = row.source as PriceSource;
    const list = map.get(key) ?? [];
    list.push({ date: new Date(row.captured_on).toISOString(), value: Number(row.price) });
    map.set(key, list);
  }
  return map;
}

/** Capture today's quotes for a card and refresh its latest/change rollup. */
export async function snapshotCard(card: CardLike) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const quotes = (await quoteAll(card))
    .filter((q) => q.price != null)
    .map((q) => ({ ...q, price: q.price as number }));
  if (!quotes.length) return 0;
  const today = new Date().toISOString().slice(0, 10);

  const rowsToStore = quotes.map((q) => ({
    card_id: card.id,
    source: q.source,
    condition: "Near Mint",
    price: q.price,
    currency: q.currency,
    captured_on: today,
  }));

  // Cardmarket publishes real 1/7/30 day averages, so a brand new card
  // immediately gets three genuine dated readings.
  for (const seed of await cardmarketHistorySeeds(card.id)) {
    const d = new Date();
    d.setDate(d.getDate() - seed.daysAgo);
    rowsToStore.push({
      card_id: card.id,
      source: "cardmarket",
      condition: "Near Mint",
      price: seed.price,
      currency: "USD",
      captured_on: d.toISOString().slice(0, 10),
    });
  }

  await supabaseAdmin
    .from("card_price_points")
    .upsert(rowsToStore, { onConflict: "card_id,source,condition,captured_on" });

  const history = await loadStored(card.id, 40);
  const rows = quotes.map((q) => {
    const pts = history.get(q.source) ?? [];
    const at = (daysAgo: number) => {
      const cut = Date.now() - daysAgo * 86400000;
      const prior = pts.filter((p) => new Date(p.date).getTime() <= cut);
      return prior.at(-1)?.value ?? null;
    };
    const pct = (old: number | null) =>
      old && old > 0 ? Number((((q.price - old) / old) * 100).toFixed(2)) : null;
    return {
      card_id: card.id,
      source: q.source,
      price: q.price,
      currency: q.currency,
      change_24h: pct(at(1)),
      change_7d: pct(at(7)),
      change_30d: pct(at(30)),
      updated_at: new Date().toISOString(),
    };
  });
  await supabaseAdmin.from("card_price_latest").upsert(rows, { onConflict: "card_id,source" });
  return rows.length;
}

/* --------------------------------- movers -------------------------------- */

export type MoverWindow = "24h" | "7d" | "30d";

export interface MoverRow {
  cardId: string;
  name: string;
  setName: string;
  setCode: string | null;
  number: string;
  language: string;
  image: string | null;
  price: number;
  change: number;
}

const COL: Record<MoverWindow, "change_24h" | "change_7d" | "change_30d"> = {
  "24h": "change_24h",
  "7d": "change_7d",
  "30d": "change_30d",
};

export async function getMovers(opts: {
  window: MoverWindow;
  language: "EN" | "JP";
  limit?: number;
  cardIds?: string[];
}) {
  const limit = opts.limit ?? 10;
  const col = COL[opts.window];

  const pull = async (asc: boolean) => {
    let q = supabase
      .from("card_price_latest")
      .select(
        `card_id,price,${col},tcg_cards!inner(name,set_name,set_code,number,language,image_small,image_large)`,
      )
      .not(col, "is", null)
      .eq("tcg_cards.language", opts.language)
      .order(col, { ascending: asc })
      .limit(limit);
    if (opts.cardIds?.length) q = q.in("card_id", opts.cardIds);
    const { data } = await q;
    return (data ?? []) as unknown as any[];
  };

  const [up, down] = await Promise.all([pull(false), pull(true)]);
  const map = (rows: any[]): MoverRow[] =>
    rows.map((r) => ({
      cardId: r.card_id,
      name: r.tcg_cards.name,
      setName: r.tcg_cards.set_name,
      setCode: r.tcg_cards.set_code,
      number: r.tcg_cards.number,
      language: r.tcg_cards.language,
      image: r.tcg_cards.image_large ?? r.tcg_cards.image_small,
      price: Number(r.price),
      change: Number(r[col]),
    }));

  // Real readings only. When the captured history does not yet cover this
  // window the lists come back empty and the UI shows "no data".
  return {
    gainers: map(up).filter((m) => m.change > 0),
    losers: map(down).filter((m) => m.change < 0),
  };
}

/* ------------------------------ market pulse ------------------------------ */

export interface MarketPulse {
  language: "EN" | "JP";
  window: MoverWindow;
  /** Average observed % change across every card with a captured reading. */
  averageChange: number | null;
  tracked: number;
}

export async function getMarketPulse(
  language: "EN" | "JP",
  window: MoverWindow,
): Promise<MarketPulse> {
  const col = COL[window];
  const { data } = await supabase
    .from("card_price_latest")
    .select(`${col},tcg_cards!inner(language)`)
    .not(col, "is", null)
    .eq("tcg_cards.language", language)
    .limit(5000);

  const values = ((data ?? []) as any[]).map((r) => Number(r[col])).filter(Number.isFinite);
  if (!values.length) return { language, window, averageChange: null, tracked: 0 };
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return {
    language,
    window,
    averageChange: Number(avg.toFixed(2)),
    tracked: values.length,
  };
}

/* ---------------------------- portfolio history --------------------------- */

export interface Holding {
  cardId: string;
  quantity: number;
  /** Condition multiplier applied to the observed market reading. */
  multiplier: number;
}

/**
 * Portfolio value over time, assembled purely from captured readings.
 * Days without any reading for a card carry that card's last real reading
 * forward (no synthetic values are created); before a card's first reading it
 * simply contributes nothing.
 */
export async function getPortfolioSeries(holdings: Holding[], days: number) {
  if (!holdings.length) return [] as { date: string; value: number }[];
  const since = new Date();
  since.setDate(since.getDate() - days);
  const ids = [...new Set(holdings.map((h) => h.cardId))];

  const { data } = await supabase
    .from("card_price_points")
    .select("card_id,price,captured_on")
    .in("card_id", ids)
    .gte("captured_on", since.toISOString().slice(0, 10))
    .order("captured_on", { ascending: true })
    .limit(20000);

  const rows = (data ?? []) as { card_id: string; price: number; captured_on: string }[];
  if (!rows.length) return [];

  // Average the sources observed for a card on a given day.
  const byDay = new Map<string, Map<string, { sum: number; n: number }>>();
  for (const r of rows) {
    const day = r.captured_on.slice(0, 10);
    const cards = byDay.get(day) ?? new Map();
    const acc = cards.get(r.card_id) ?? { sum: 0, n: 0 };
    acc.sum += Number(r.price);
    acc.n += 1;
    cards.set(r.card_id, acc);
    byDay.set(day, cards);
  }

  const last = new Map<string, number>();
  const out: { date: string; value: number }[] = [];
  for (const day of [...byDay.keys()].sort()) {
    for (const [cardId, acc] of byDay.get(day)!) last.set(cardId, acc.sum / acc.n);
    let total = 0;
    for (const h of holdings) {
      const price = last.get(h.cardId);
      if (price == null) continue;
      total += price * h.quantity * h.multiplier;
    }
    out.push({ date: new Date(day).toISOString(), value: Number(total.toFixed(2)) });
  }
  return out;
}

/** Load the minimal card shape the adapters need. */
export async function loadCard(cardId: string): Promise<CardLike | null> {
  const { data } = await supabase
    .from("tcg_cards")
    .select("id,name,number,set_name,language,market_price")
    .eq("id", cardId)
    .maybeSingle();
  if (!data) return null;
  const row = data as any;
  return {
    id: row.id,
    name: row.name,
    number: row.number,
    setName: row.set_name,
    language: row.language,
    marketPrice: Number(row.market_price ?? 0),
  };
}

/** Cards worth snapshotting first: highest market value, both languages. */
export async function snapshotTargets(limit: number, offset = 0) {
  const { data } = await supabase
    .from("tcg_cards")
    .select("id,name,number,set_name,language,market_price")
    .not("market_price", "is", null)
    .order("market_price", { ascending: false })
    .range(offset, offset + limit - 1);
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    name: row.name,
    number: row.number,
    setName: row.set_name,
    language: row.language,
    marketPrice: Number(row.market_price ?? 0),
  })) as CardLike[];
}
