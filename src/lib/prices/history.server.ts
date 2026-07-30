/**
 * Price history assembly (server-only).
 *
 * Real readings live in `card_price_points`, captured by the snapshot endpoint.
 * Until a card has enough captured readings for the requested window we return
 * a modelled series anchored to the live quote, and flag it as modelled so the
 * UI never presents an estimate as a real observation.
 */
import { supabase } from "@/integrations/supabase/client";
import type { PriceSource, TimeRange } from "@/lib/tcg/types";
import { RANGE_DAYS } from "@/lib/tcg/types";
import { quoteAll, sourcesFor, type Quote } from "./sources.server";

export interface SeriesBySource {
  source: PriceSource;
  currency: string;
  live: boolean;
  modelled: boolean;
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

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function modelSeries(seed: string, anchor: number, range: TimeRange) {
  const days = RANGE_DAYS[range];
  const steps = range === "1D" ? 24 : Math.min(days, 120);
  const rand = rng(hash(seed));
  const drift = ((hash(seed) % 1600) - 700) / 10000;
  let value = anchor / (1 + drift * (days / 30));
  const out: { date: string; value: number }[] = [];
  for (let i = steps; i >= 0; i--) {
    const d = new Date();
    if (range === "1D") d.setHours(d.getHours() - i);
    else d.setDate(d.getDate() - Math.round((i * days) / steps));
    value += (anchor - value) / Math.max(2, i + 1) + (rand() - 0.5) * anchor * 0.02;
    out.push({ date: d.toISOString(), value: Math.max(0.05, Number(value.toFixed(2))) });
  }
  out[out.length - 1].value = Number(anchor.toFixed(2));
  return out;
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

  const series: SeriesBySource[] = sourcesFor(card.language).map((source) => {
    const quote = quotes.find((q) => q.source === source);
    const points = stored.get(source) ?? [];
    const anchor = quote?.price ?? points.at(-1)?.value ?? card.marketPrice;
    if (points.length >= 3) {
      return {
        source,
        currency: quote?.currency ?? "USD",
        live: true,
        modelled: false,
        points,
      };
    }
    return {
      source,
      currency: quote?.currency ?? "USD",
      live: Boolean(quote?.live),
      modelled: true,
      note: quote?.note,
      points: modelSeries(card.id + source + range, anchor, range),
    };
  });

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
  const quotes = (await quoteAll(card)).filter((q) => q.price != null);
  if (!quotes.length) return 0;
  const today = new Date().toISOString().slice(0, 10);

  await supabaseAdmin.from("card_price_points").upsert(
    quotes.map((q) => ({
      card_id: card.id,
      source: q.source,
      condition: "Near Mint",
      price: q.price,
      currency: q.currency,
      captured_on: today,
    })),
    { onConflict: "card_id,source,condition,captured_on" },
  );

  const history = await loadStored(card.id, 40);
  const rows = quotes.map((q) => {
    const pts = history.get(q.source) ?? [];
    const at = (daysAgo: number) => {
      const cut = Date.now() - daysAgo * 86400000;
      const prior = pts.filter((p) => new Date(p.date).getTime() <= cut);
      return prior.at(-1)?.value ?? null;
    };
    const pct = (old: number | null) =>
      old && old > 0 ? Number((((q.price! - old) / old) * 100).toFixed(2)) : null;
    return {
      card_id: card.id,
      source: q.source,
      price: q.price,
      currency: q.currency,
      change_24h: pct(1),
      change_7d: pct(7),
      change_30d: pct(30),
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
  estimated: boolean;
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
      estimated: false,
    }));

  if (up.length || down.length) {
    return {
      gainers: map(up).filter((m) => m.change > 0),
      losers: map(down).filter((m) => m.change < 0),
      estimated: false,
    };
  }
  return { ...(await estimatedMovers(opts, limit)), estimated: true };
}

/** Deterministic stand-in while the daily snapshot history is still filling. */
async function estimatedMovers(
  opts: { window: MoverWindow; language: "EN" | "JP"; cardIds?: string[] },
  limit: number,
) {
  let q = supabase
    .from("tcg_cards")
    .select("id,name,set_name,set_code,number,language,image_small,image_large,market_price")
    .eq("language", opts.language)
    .not("market_price", "is", null)
    .order("market_price", { ascending: false })
    .limit(opts.cardIds?.length ? 400 : 240);
  if (opts.cardIds?.length) q = q.in("id", opts.cardIds);
  const { data } = await q;
  const factor = opts.window === "24h" ? 0.35 : opts.window === "7d" ? 1 : 2.6;
  const rows: MoverRow[] = ((data ?? []) as any[]).map((r) => {
    const seed = hash(r.id + opts.window);
    return {
      cardId: r.id,
      name: r.name,
      setName: r.set_name,
      setCode: r.set_code,
      number: r.number,
      language: r.language,
      image: r.image_large ?? r.image_small,
      price: Number(r.market_price ?? 0),
      change: Number(((((seed % 1800) - 850) / 100) * factor).toFixed(2)),
      estimated: true,
    };
  });
  const sorted = [...rows].sort((a, b) => b.change - a.change);
  return {
    gainers: sorted.filter((m) => m.change > 0).slice(0, limit),
    losers: [...sorted].reverse().filter((m) => m.change < 0).slice(0, limit),
  };
}
