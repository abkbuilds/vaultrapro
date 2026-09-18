/**
 * Shared parsing of the TCGGO price blocks.
 *
 * The feed occasionally publishes a nonsense "lowest near mint" asking price
 * (a mis-keyed listing — e.g. €9,001 for a card whose 7 and 30 day averages are
 * €22 and €17). Those single asking prices are not market readings, so they are
 * rejected in favour of the feed's own published rolling average. Nothing here
 * invents a number: every value returned is a figure the feed published.
 */

export type PriceBlock = Record<string, unknown> | null | undefined;

export function positive(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Number(v.toFixed(2)) : null;
}

/** Currency the block is quoted in (the feed states it per block). */
export function blockCurrency(block: PriceBlock, fallback = "EUR"): string {
  const c = block?.["currency"];
  return typeof c === "string" && c.length === 3 ? c.toUpperCase() : fallback;
}

function firstOf(block: PriceBlock, keys: string[]): number | null {
  if (!block) return null;
  for (const k of keys) {
    const v = positive(block[k]);
    if (v != null) return v;
  }
  return null;
}

/** Published rolling averages, newest window first. */
export function rollingAverages(block: PriceBlock) {
  const out: { daysAgo: number; value: number }[] = [];
  for (const [daysAgo, key] of [
    [30, "30d_average"],
    [7, "7d_average"],
  ] as const) {
    const v = positive(block?.[key]);
    if (v != null) out.push({ daysAgo, value: v });
  }
  return out;
}

/**
 * Sanity-checks an asking price against the published rolling averages and
 * falls back to the 7 (then 30) day average when it is clearly a bad listing.
 */
function sane(low: number | null, block: PriceBlock): number | null {
  const avg7 = positive(block?.["7d_average"]);
  const avg30 = positive(block?.["30d_average"]);
  const refs = [avg7, avg30].filter((v): v is number => v != null);
  if (low == null) return avg7 ?? avg30 ?? null;
  if (!refs.length) return low;
  const hi = Math.max(...refs);
  const lo = Math.min(...refs);
  if (low > hi * 4 || low * 4 < lo) return avg7 ?? avg30;
  return low;
}

const NEAR_MINT_KEYS = [
  "lowest_near_mint",
  "lowest_near_mint_JP",
  "lowest_near_mint_EU_only",
  "lowest_near_mint_JP_EU_only",
];

/** Cardmarket near-mint reading for a single card, outlier-guarded. */
export function cardmarketNearMint(block: PriceBlock): number | null {
  return sane(firstOf(block, NEAR_MINT_KEYS), block);
}

/** Cardmarket asking price for a sealed product, outlier-guarded. */
export function cardmarketProductLow(block: PriceBlock): number | null {
  return sane(firstOf(block, ["lowest", "lowest_EU_only"]), block);
}
