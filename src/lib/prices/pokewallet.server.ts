/**
 * PokéWallet adapter (server-only).
 *
 * https://www.pokewallet.io/api-docs — one keyed REST API that republishes
 * real TCGplayer and Cardmarket figures for English *and* Japanese printings,
 * including promos. It is used as a fallback whenever the keyless feeds have
 * no reading for a printing, and as a source of genuine dated Cardmarket
 * averages (1/7/30 day) for history backfill.
 *
 * Free plan is 100 requests/hour, so every lookup is cached in-process and
 * misses are cached too.
 */

const BASE = "https://api.pokewallet.io";

export interface PokewalletMatch {
  /** TCGplayer market price, USD. */
  tcgplayerUsd: number | null;
  /** Cardmarket trend price, EUR. */
  cardmarketEur: number | null;
  /** Real dated Cardmarket averages in EUR, oldest first. */
  cardmarketSeedsEur: { daysAgo: number; price: number }[];
  setCode?: string;
  cardNumber?: string;
}

interface CacheEntry {
  value: PokewalletMatch | null;
  expires: number;
}

const cache = new Map<string, CacheEntry>();
const TTL = 6 * 3600_000;

function apiKey() {
  return process.env["POKEWALLET_API_KEY"] || process.env["POKEWALLET_TEST_API_KEY"] || null;
}

export function pokewalletEnabled() {
  return Boolean(apiKey());
}

/** Bare card number ("215/203" -> "215", "SV-P 042" -> "042"). */
function baseNumber(n: string) {
  return (n.split("/")[0] ?? n).trim().replace(/^0+(?=\d)/, "").toLowerCase();
}

function pickNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : null;
}

async function search(query: string): Promise<any[]> {
  const key = apiKey();
  if (!key) return [];
  try {
    const res = await fetch(
      `${BASE}/search?limit=20&q=${encodeURIComponent(query)}`,
      { headers: { "X-API-Key": key, accept: "application/json" } },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: any[] };
    return json.results ?? [];
  } catch {
    return [];
  }
}

function scoreResult(row: any, card: { name: string; number: string; setCode?: string }) {
  const info = row?.card_info ?? {};
  let score = 0;
  if (baseNumber(String(info.card_number ?? "")) === baseNumber(card.number)) score += 4;
  const code = String(info.set_code ?? "").toLowerCase();
  const want = (card.setCode ?? "").toLowerCase();
  if (want && (code === want || code.endsWith(want) || want.endsWith(code))) score += 3;
  const clean = String(info.clean_name ?? info.name ?? "").toLowerCase();
  if (clean && card.name.toLowerCase().includes(clean.split(" - ")[0]!)) score += 1;
  return score;
}

function toMatch(row: any): PokewalletMatch {
  const tcg = (row?.tcgplayer?.prices ?? []) as any[];
  const tcgplayerUsd =
    pickNum(tcg.find((p) => pickNum(p?.market_price))?.market_price) ??
    pickNum(tcg.find((p) => pickNum(p?.mid_price))?.mid_price);

  const cm = ((row?.cardmarket?.prices ?? []) as any[]).find(
    (p) => pickNum(p?.trend) ?? pickNum(p?.avg),
  );
  const cardmarketEur = cm ? (pickNum(cm.trend) ?? pickNum(cm.avg)) : null;
  const seeds: { daysAgo: number; price: number }[] = [];
  if (cm) {
    for (const [daysAgo, field] of [
      [30, "avg30"],
      [7, "avg7"],
      [1, "avg1"],
    ] as const) {
      const v = pickNum(cm[field]);
      if (v != null) seeds.push({ daysAgo, price: v });
    }
  }
  return {
    tcgplayerUsd,
    cardmarketEur,
    cardmarketSeedsEur: seeds,
    setCode: row?.card_info?.set_code,
    cardNumber: row?.card_info?.card_number,
  };
}

/** Best PokéWallet match for a catalogue card, or null when nothing matches. */
export async function pokewalletLookup(card: {
  id: string;
  name: string;
  number: string;
  setName?: string;
  setCode?: string;
}): Promise<PokewalletMatch | null> {
  if (!pokewalletEnabled()) return null;
  const hit = cache.get(card.id);
  if (hit && hit.expires > Date.now()) return hit.value;

  const queries = [
    `${card.name} ${baseNumber(card.number)}`,
    card.setCode ? `${card.name} ${card.setCode}` : null,
    card.name,
  ].filter(Boolean) as string[];

  let best: { row: any; score: number } | null = null;
  for (const q of queries) {
    for (const row of await search(q)) {
      const score = scoreResult(row, card);
      if (!best || score > best.score) best = { row, score };
    }
    // A number + set match is unambiguous; stop burning rate limit.
    if (best && best.score >= 7) break;
  }

  // Below this the match is a guess, and a wrong card's price is worse than
  // no price at all.
  const value = best && best.score >= 4 ? toMatch(best.row) : null;
  cache.set(card.id, { value, expires: Date.now() + TTL });
  return value;
}
