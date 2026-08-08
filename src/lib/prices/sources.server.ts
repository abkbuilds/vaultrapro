/**
 * Marketplace price adapters (server-only).
 *
 * Each marketplace lives behind one function with the same shape, so adding a
 * new venue never touches UI code. Adapters that need partner credentials
 * report `live: false` with a reason when the credential is missing instead of
 * inventing a number.
 *
 * - TCGplayer              : api.pokemontcg.io (real market prices, EN)
 * - Cardmarket             : api.tcgdex.net (real EN + JP prices, no API key)
 * - eBay                   : Browse API (needs EBAY_CLIENT_ID + EBAY_CLIENT_SECRET)
 * - snkrdunk               : no public API — needs SNKRDUNK_API_TOKEN partner feed
 */
import type { PriceSource } from "@/lib/tcg/types";

export interface Quote {
  source: PriceSource;
  price: number | null;
  currency: string;
  live: boolean;
  /** Why a quote is missing, surfaced in the UI so numbers stay trustworthy. */
  note?: string;
}

const PTCG = "https://api.pokemontcg.io/v2";

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const headers: Record<string, string> = { accept: "application/json" };
    const key = process.env.POKEMONTCG_API_KEY;
    if (key && url.startsWith(PTCG)) headers["X-Api-Key"] = key;
    const res = await fetch(url, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string>) },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const v = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return Number(v.toFixed(2));
}

/* ------------------------------ TCGplayer ------------------------------- */

export async function quoteTcgplayer(card: {
  id: string;
  name?: string;
  setCode?: string;
  number?: string;
  language?: string;
}): Promise<Quote> {

  const cardId = card.id;
  // English cards: the Pokémon TCG API republishes TCGplayer's price block.
  if (cardId.startsWith("en-")) {
    const json = await getJson<{ data?: Record<string, any> }>(
      `${PTCG}/cards/${cardId.replace(/^en-/, "")}`,
    );
    const prices = json?.data?.tcgplayer?.prices as Record<string, any> | undefined;
    if (prices) {
      const order = [
        "holofoil",
        "normal",
        "reverseHolofoil",
        "1stEditionHolofoil",
        "unlimitedHolofoil",
      ];
      for (const k of [...order, ...Object.keys(prices)]) {
        const v = prices[k]?.market ?? prices[k]?.mid;
        if (typeof v === "number" && v > 0) {
          return { source: "tcgplayer", price: Number(v.toFixed(2)), currency: "USD", live: true };
        }
      }
    }
  }

  // Fallback (and the primary path for Japanese printings): the keyless
  // tcgcsv.com mirror of the TCGplayer catalogue, which covers both the
  // English and the Japanese category including promos.
  if (card.setCode && card.number) {
    const { tcgplayerMarketPrice } = await import("./tcgcsv.server");
    const price = await tcgplayerMarketPrice({
      setCode: card.setCode,
      number: card.number,
      language: card.language ?? (cardId.startsWith("jp-") ? "JP" : "EN"),
    });
    if (price != null) {
      return { source: "tcgplayer", price, currency: "USD", live: true };
    }
  }

  // Last resort: PokéWallet republishes TCGplayer's price block for EN and JP
  // printings (keyed API), which covers products the keyless mirrors miss.
  {
    const { pokewalletLookup } = await import("./pokewallet.server");
    const match = await pokewalletLookup({
      id: cardId,
      name: (card as { name?: string }).name ?? "",
      number: card.number ?? "",
      setCode: card.setCode,
    });
    if (match?.tcgplayerUsd != null) {
      return {
        source: "tcgplayer",
        price: match.tcgplayerUsd,
        currency: "USD",
        live: true,
        note: "via PokéWallet",
      };
    }
  }

  return {
    source: "tcgplayer",
    price: null,
    currency: "USD",
    live: false,
    note: "No TCGplayer listing for this printing",
  };
}



/* ------------------------------- Cardmarket ------------------------------ */
/**
 * TCGdex republishes Cardmarket's daily figures for both English and Japanese
 * printings and needs no API key, so it is the default live source. It also
 * exposes 1/7/30-day averages, which we replay as real historical readings.
 */
const TCGDEX = "https://api.tcgdex.net/v2";

function tcgdexUrl(cardId: string) {
  const jp = cardId.startsWith("jp-");
  return `${TCGDEX}/${jp ? "ja" : "en"}/cards/${cardId.replace(/^(jp|en)-/, "")}`;
}

type CardmarketBlock = Record<string, number | null | string>;

/**
 * Cardmarket quotes in EUR. Charts and portfolio totals are USD, so convert
 * with the ECB daily reference rate (Frankfurter, keyless), cached for 6h.
 */
let eurUsd: { rate: number; expires: number } | null = null;
async function eurToUsd(): Promise<number> {
  if (eurUsd && eurUsd.expires > Date.now()) return eurUsd.rate;
  const json = await getJson<{ rates?: { USD?: number } }>(
    "https://api.frankfurter.app/latest?from=EUR&to=USD",
  );
  const rate = json?.rates?.USD;
  if (typeof rate === "number" && rate > 0) {
    eurUsd = { rate, expires: Date.now() + 6 * 3600_000 };
    return rate;
  }
  return eurUsd?.rate ?? 1.08;
}

async function cardmarketBlock(cardId: string): Promise<CardmarketBlock | null> {
  const json = await getJson<{ pricing?: { cardmarket?: CardmarketBlock | null } }>(
    tcgdexUrl(cardId),
  );
  return json?.pricing?.cardmarket ?? null;
}

function pickNumber(block: CardmarketBlock, keys: string[]) {
  for (const k of keys) {
    const v = block[k];
    if (typeof v === "number" && v > 0) return Number(v.toFixed(2));
  }
  return null;
}

export interface CardRef {
  id: string;
  name?: string;
  number?: string;
  setCode?: string;
}

function refOf(card: string | CardRef): CardRef {
  return typeof card === "string" ? { id: card } : card;
}

export async function quoteCardmarket(input: string | CardRef): Promise<Quote> {
  const card = refOf(input);
  const block = await cardmarketBlock(card.id);
  const rate = await eurToUsd();
  const eur = block ? pickNumber(block, ["trend-holo", "trend", "avg-holo", "avg", "low"]) : null;
  if (eur != null) {
    return {
      source: "cardmarket",
      price: Number((eur * rate).toFixed(2)),
      currency: "USD",
      live: true,
      note: `Cardmarket trend \u20ac${eur.toFixed(2)} at ECB ${rate.toFixed(3)}`,
    };
  }

  // PokéWallet also republishes Cardmarket, and covers printings TCGdex misses.
  const { pokewalletLookup } = await import("./pokewallet.server");
  const match = await pokewalletLookup({
    id: card.id,
    name: card.name ?? "",
    number: card.number ?? "",
    setCode: card.setCode,
  });
  if (match?.cardmarketEur != null) {
    return {
      source: "cardmarket",
      price: Number((match.cardmarketEur * rate).toFixed(2)),
      currency: "USD",
      live: true,
      note: `Cardmarket trend \u20ac${match.cardmarketEur.toFixed(2)} via Pok\u00e9Wallet`,
    };
  }

  return {
    source: "cardmarket",
    price: null,
    currency: "USD",
    live: false,
    note: block ? "Cardmarket has no price yet" : "No Cardmarket listing for this printing",
  };
}

/**
 * Real dated readings we can backfill immediately: Cardmarket's 1, 7 and 30 day
 * averages (from TCGdex, falling back to PokéWallet). Oldest-first.
 */
export async function cardmarketHistorySeeds(input: string | CardRef) {
  const card = refOf(input);
  const rate = await eurToUsd();
  const block = await cardmarketBlock(card.id);
  const seeds: { daysAgo: number; price: number }[] = [];
  if (block) {
    const holo = typeof block["trend-holo"] === "number" && (block["trend-holo"] as number) > 0;
    const key = (base: string) => (holo ? `${base}-holo` : base);
    for (const [daysAgo, base] of [
      [30, "avg30"],
      [7, "avg7"],
      [1, "avg1"],
    ] as const) {
      const v = pickNumber(block, [key(base), base]);
      if (v != null) seeds.push({ daysAgo, price: Number((v * rate).toFixed(2)) });
    }
  }
  if (seeds.length) return seeds;

  const { pokewalletLookup } = await import("./pokewallet.server");
  const match = await pokewalletLookup({
    id: card.id,
    name: card.name ?? "",
    number: card.number ?? "",
    setCode: card.setCode,
  });
  return (match?.cardmarketSeedsEur ?? []).map((s) => ({
    daysAgo: s.daysAgo,
    price: Number((s.price * rate).toFixed(2)),
  }));
}


/* --------------------------------- eBay --------------------------------- */

/**
 * Live eBay reading. Delegates to the shared Browse adapter so the per-card
 * quote and the bulk backfill always agree on matching and median rules.
 */
export async function quoteEbay(card: {
  name: string;
  number: string;
  setName?: string;
  setCode?: string;
  language?: string;
}): Promise<Quote> {
  const { ebayCardQuote } = await import("./ebay.server");
  const q = await ebayCardQuote(card);
  return {
    source: "ebay",
    price: q.price,
    currency: q.currency,
    live: q.live,
    note: q.note,
  };
}


/* -------------------------------- snkrdunk ------------------------------ */

export async function quoteSnkrdunk(query: string): Promise<Quote> {
  const token = process.env.SNKRDUNK_API_TOKEN;
  if (!token) {
    return {
      source: "snkrdunk",
      price: null,
      currency: "JPY",
      live: false,
      note: "snkrdunk has no public API — a partner token is required",
    };
  }
  const json = await getJson<Record<string, any>>(
    `https://snkrdunk.com/api/v1/trading-cards/search?keyword=${encodeURIComponent(query)}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const first = (json?.items ?? json?.data ?? [])[0];
  const yen = Number(first?.minPrice ?? first?.price);
  return {
    source: "snkrdunk",
    price: Number.isFinite(yen) && yen > 0 ? yen : null,
    currency: "JPY",
    live: Number.isFinite(yen) && yen > 0,
    note: Number.isFinite(yen) && yen > 0 ? undefined : "No snkrdunk match",
  };
}

/** Sources that apply to a card, by language. */
export function sourcesFor(language: string): PriceSource[] {
  // TCGplayer lists Japanese singles too (category 85), reachable keylessly via
  // tcgcsv.com, so it applies to both languages.
  return language === "JP"
    ? ["tcgplayer", "cardmarket", "ebay", "snkrdunk"]
    : ["tcgplayer", "cardmarket", "ebay"];
}

export async function quoteAll(card: {
  id: string;
  name: string;
  number: string;
  setName: string;
  setCode?: string;
  language: string;
}): Promise<Quote[]> {
  const query = `${card.name} ${card.setName} ${card.number} pokemon card`;
  const wanted = sourcesFor(card.language);
  const runners: Record<PriceSource, () => Promise<Quote>> = {
    tcgplayer: () =>
      quoteTcgplayer({
        id: card.id,
        name: card.name,
        setCode: card.setCode,
        number: card.number,
        language: card.language,
      }),
    cardmarket: () =>
      quoteCardmarket({
        id: card.id,
        name: card.name,
        number: card.number,
        setCode: card.setCode,
      }),

    ebay: () =>
      quoteEbay({
        name: card.name,
        number: card.number,
        setName: card.setName,
        setCode: card.setCode,
        language: card.language,
      }),

    snkrdunk: () => quoteSnkrdunk(query),
  } as never;
  return Promise.all(wanted.map((s) => runners[s]()));
}

