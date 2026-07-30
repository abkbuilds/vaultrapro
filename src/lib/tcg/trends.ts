import { CARDS } from "./cards";
import type { GameId, PricePoint, TcgCard, TimeRange } from "./types";
import { GAMES, RANGE_DAYS } from "./types";

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

export interface MarketIndex {
  game: GameId;
  name: string;
  short: string;
  index: number;
  change: number;
  series: PricePoint[];
}

const BASE_INDEX: Record<GameId, number> = {
  pokemon: 1284,
  magic: 968,
  onepiece: 742,
  lorcana: 511,
  yugioh: 623,
};

const WEEKLY_TREND: Record<GameId, number> = {
  pokemon: 3.8,
  magic: -1.2,
  onepiece: 7.9,
  lorcana: 5.1,
  yugioh: -2.6,
};

export function getMarketIndex(game: GameId, range: TimeRange): MarketIndex {
  const meta = GAMES.find((g) => g.id === game)!;
  const days = RANGE_DAYS[range];
  const steps = Math.min(days, 90);
  const rand = rng(hash(game + range));
  const end = BASE_INDEX[game];
  const totalChange = (WEEKLY_TREND[game] / 100) * (days / 7) * 0.55;
  let value = end / (1 + totalChange);
  const start = value;
  const series: PricePoint[] = [];
  for (let i = steps; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - (i * days) / steps);
    value += (end - start) / steps + (rand() - 0.5) * end * 0.012;
    series.push({ date: d.toISOString(), value: Number(value.toFixed(2)) });
  }
  series[series.length - 1].value = end;
  return {
    game,
    name: meta.name,
    short: meta.short,
    index: end,
    change: Number((((end - start) / start) * 100).toFixed(2)),
    series,
  };
}

export function getAllIndices(range: TimeRange): MarketIndex[] {
  return GAMES.map((g) => getMarketIndex(g.id, range)).sort(
    (a, b) => b.change - a.change,
  );
}

export interface Mover {
  card: TcgCard;
  change: number;
}

export function getMovers(game: GameId, range: TimeRange) {
  const factor = { "1D": 0.2, "1W": 1, "1M": 2.4, "3M": 4.1, "1Y": 7.5, ALL: 11 }[range];
  const pool = CARDS.filter((c) => c.game === game);
  const scored: Mover[] = pool.map((card) => {
    const rand = rng(hash(card.id + range));
    return {
      card,
      change: Number((card.change7d * factor * (0.7 + rand() * 0.7)).toFixed(2)),
    };
  });
  const sorted = [...scored].sort((a, b) => b.change - a.change);
  return {
    gainers: sorted.filter((m) => m.change > 0).slice(0, 10),
    losers: [...sorted].reverse().filter((m) => m.change < 0).slice(0, 10),
  };
}
