/**
 * Price service layer.
 *
 * Each source is isolated behind its own module-level function so a real API
 * client (TCGplayer, eBay Browse/Marketplace Insights, snkrdunk, PriceCharting)
 * can be dropped in without touching UI code. Today they return deterministic
 * mock series derived from the card's market price.
 */
import type {
  Condition,
  Listing,
  PricePoint,
  PriceSource,
  TcgCard,
  TimeRange,
} from "./types";
import { CONDITIONS, RANGE_DAYS, SOURCE_META } from "./types";

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

function dayLabel(daysAgo: number, range: TimeRange) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  if (range === "1D") {
    const h = new Date();
    h.setHours(h.getHours() - daysAgo * 24);
    return h.toISOString();
  }
  return d.toISOString();
}

const SOURCE_BIAS: Record<PriceSource, number> = {
  tcgplayer: 1,
  cardmarket: 0.9,
  ebay: 0.94,
  snkrdunk: 1.06,
  pricecharting: 0.98,
};

export function sourcesForCard(card: TcgCard): PriceSource[] {
  return (Object.keys(SOURCE_META) as PriceSource[]).filter((s) =>
    SOURCE_META[s].languages.includes(card.language),
  );
}

export function getPriceSeries(
  card: TcgCard,
  source: PriceSource,
  range: TimeRange,
): PricePoint[] {
  const days = RANGE_DAYS[range];
  const steps = range === "1D" ? 24 : Math.min(days, 120);
  const stepDays = days / steps;
  const rand = rng(hash(card.id + source));
  const base = card.marketPrice * SOURCE_BIAS[source];
  const drift = (card.change7d / 100) * base;
  const out: PricePoint[] = [];
  let value = base - drift * (days / 7) * 0.25;
  for (let i = steps; i >= 0; i--) {
    const noise = (rand() - 0.5) * base * 0.045;
    value += drift * (stepDays / 7) * 0.25 + noise;
    out.push({
      date: dayLabel(i * stepDays, range),
      value: Math.max(0.5, Number(value.toFixed(2))),
    });
  }
  // pin the last point close to the quoted market price
  out[out.length - 1].value = Number(base.toFixed(2));
  return out;
}

export function getCombinedSeries(card: TcgCard, range: TimeRange) {
  const sources = sourcesForCard(card);
  const series = sources.map((s) => getPriceSeries(card, s, range));
  return series[0].map((point, i) => {
    const row: Record<string, string | number> = { date: point.date };
    sources.forEach((s, si) => {
      row[s] = series[si][i].value;
    });
    return row;
  });
}

export function getRecentListings(card: TcgCard, count = 12): Listing[] {
  const sources = sourcesForCard(card);
  const rand = rng(hash(card.id + "listings"));
  return Array.from({ length: count }, (_, i) => {
    const source = sources[Math.floor(rand() * sources.length)];
    const condition = CONDITIONS[Math.floor(rand() * 4)] as Condition;
    const kind =
      source === "snkrdunk"
        ? rand() > 0.6
          ? "buyback"
          : "listing"
        : rand() > 0.35
          ? "sale"
          : "listing";
    const d = new Date();
    d.setHours(d.getHours() - Math.floor(rand() * 24 * 20));
    return {
      id: `${card.id}-l${i}`,
      date: d.toISOString(),
      source,
      condition,
      kind: kind as Listing["kind"],
      price: Number(
        (card.marketPrice * SOURCE_BIAS[source] * (0.8 + rand() * 0.45)).toFixed(2),
      ),
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}
