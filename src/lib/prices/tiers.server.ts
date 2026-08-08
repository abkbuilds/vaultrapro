/**
 * TCGplayer price tiers (server-only, keyless).
 *
 * The Pokémon TCG API (pokemontcg.io) republishes TCGplayer's full daily price
 * block — low / mid / high / market / directLow per printing variant — which is
 * the same structure the reference `pokecardprices` project charts. We surface
 * it verbatim: no averaging, no estimation. Japanese printings are not covered
 * by that feed, so they simply return no tiers.
 */

const PTCG = "https://api.pokemontcg.io/v2";

export interface PriceTiers {
  /** Printing variant, e.g. `holofoil`, `normal`, `reverseHolofoil`. */
  variant: string;
  low: number | null;
  mid: number | null;
  high: number | null;
  market: number | null;
  directLow: number | null;
}

export interface TiersPayload {
  updatedAt: string | null;
  currency: "USD";
  tiers: PriceTiers[];
  note?: string;
}

const cache = new Map<string, { at: number; value: TiersPayload }>();
const TTL = 6 * 3600_000;

function num(v: unknown): number | null {
  return typeof v === "number" && v > 0 ? Number(v.toFixed(2)) : null;
}

export async function fetchPriceTiers(
  cardId: string,
  ref?: { setCode?: string | null; number?: string | null; language?: string | null },
): Promise<TiersPayload> {
  const hit = cache.get(cardId);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const empty = (note: string): TiersPayload => ({
    updatedAt: null,
    currency: "USD",
    tiers: [],
    note,
  });

  // Keyless mirror of TCGplayer's own tier table — covers EN and JP printings.
  const fromMirror = ref?.setCode && ref.number
    ? await (await import("./tcgcsv.server")).tcgplayerTiers({
        setCode: ref.setCode,
        number: ref.number,
        language: ref.language ?? (cardId.startsWith("jp-") ? "JP" : "EN"),
      })
    : [];
  if (fromMirror.length) {
    const value: TiersPayload = { updatedAt: null, currency: "USD", tiers: fromMirror };
    cache.set(cardId, { at: Date.now(), value });
    return value;
  }

  if (!cardId.startsWith("en-")) {
    return empty("No TCGplayer tier data published for this printing");
  }

  let payload: TiersPayload;
  try {
    const headers: Record<string, string> = { accept: "application/json" };
    const key = process.env["POKEMONTCG_API_KEY"];
    if (key) headers["X-Api-Key"] = key;
    const res = await fetch(`${PTCG}/cards/${cardId.replace(/^en-/, "")}`, { headers });
    if (!res.ok) return empty("No TCGplayer tier data for this printing");
    const json = (await res.json()) as {
      data?: { tcgplayer?: { updatedAt?: string; prices?: Record<string, unknown> } };
    };
    const block = json.data?.tcgplayer;
    const prices = block?.prices ?? {};
    const tiers: PriceTiers[] = Object.entries(prices)
      .map(([variant, raw]) => {
        const p = (raw ?? {}) as Record<string, unknown>;
        return {
          variant,
          low: num(p["low"]),
          mid: num(p["mid"]),
          high: num(p["high"]),
          market: num(p["market"]),
          directLow: num(p["directLow"]),
        };
      })
      .filter((t) => t.low ?? t.mid ?? t.high ?? t.market ?? t.directLow);

    payload = {
      updatedAt: block?.updatedAt ?? null,
      currency: "USD",
      tiers,
      note: tiers.length ? undefined : "No TCGplayer tier data for this printing",
    };
  } catch {
    return empty("Couldn't reach the TCGplayer feed");
  }

  cache.set(cardId, { at: Date.now(), value: payload });
  return payload;
}
