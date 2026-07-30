/**
 * Marketplace price adapters (server-only).
 *
 * Each marketplace lives behind one function with the same shape, so adding a
 * new venue never touches UI code. Adapters that need partner credentials
 * report `live: false` with a reason when the credential is missing instead of
 * inventing a number.
 *
 * - TCGplayer / Cardmarket : api.pokemontcg.io (real market prices, EN)
 * - eBay                   : Browse API (needs EBAY_CLIENT_ID + EBAY_CLIENT_SECRET)
 * - PriceCharting          : api /product (needs PRICECHARTING_API_TOKEN)
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

export async function quoteTcgplayer(cardId: string): Promise<Quote> {
  if (!cardId.startsWith("en-")) {
    return {
      source: "tcgplayer",
      price: null,
      currency: "USD",
      live: false,
      note: "TCGplayer does not list Japanese printings",
    };
  }
  const json = await getJson<{ data?: Record<string, any> }>(
    `${PTCG}/cards/${cardId.replace(/^en-/, "")}`,
  );
  const prices = json?.data?.tcgplayer?.prices as Record<string, any> | undefined;
  if (!prices) {
    return {
      source: "tcgplayer",
      price: null,
      currency: "USD",
      live: false,
      note: "No TCGplayer listing for this printing",
    };
  }
  const order = ["holofoil", "normal", "reverseHolofoil", "1stEditionHolofoil", "unlimitedHolofoil"];
  for (const k of [...order, ...Object.keys(prices)]) {
    const v = prices[k]?.market ?? prices[k]?.mid;
    if (typeof v === "number" && v > 0) {
      return { source: "tcgplayer", price: Number(v.toFixed(2)), currency: "USD", live: true };
    }
  }
  return {
    source: "tcgplayer",
    price: null,
    currency: "USD",
    live: false,
    note: "TCGplayer has no market price yet",
  };
}

/* --------------------------------- eBay --------------------------------- */

let ebayToken: { value: string; expires: number } | null = null;

async function ebayAccessToken(): Promise<string | null> {
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (ebayToken && ebayToken.expires > Date.now() + 30_000) return ebayToken.value;
  try {
    const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${id}:${secret}`)}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token: string; expires_in: number };
    ebayToken = {
      value: json.access_token,
      expires: Date.now() + json.expires_in * 1000,
    };
    return ebayToken.value;
  } catch {
    return null;
  }
}

export async function quoteEbay(query: string): Promise<Quote> {
  const token = await ebayAccessToken();
  if (!token) {
    return {
      source: "ebay",
      price: null,
      currency: "USD",
      live: false,
      note: "Add eBay API keys to pull live sold data",
    };
  }
  const url =
    "https://api.ebay.com/buy/browse/v1/item_summary/search?limit=50&filter=buyingOptions:{FIXED_PRICE}&q=" +
    encodeURIComponent(query);
  const json = await getJson<{ itemSummaries?: any[] }>(url, {
    headers: {
      authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    },
  });
  const values = (json?.itemSummaries ?? [])
    .map((i) => Number(i?.price?.value))
    .filter((n) => Number.isFinite(n) && n > 0);
  const price = median(values);
  return {
    source: "ebay",
    price,
    currency: "USD",
    live: price != null,
    note: price == null ? "No matching eBay listings" : `Median of ${values.length} listings`,
  };
}

/* ----------------------------- PriceCharting ---------------------------- */

export async function quotePriceCharting(query: string): Promise<Quote> {
  const token = process.env.PRICECHARTING_API_TOKEN;
  if (!token) {
    return {
      source: "pricecharting",
      price: null,
      currency: "USD",
      live: false,
      note: "Add a PriceCharting API token to pull live data",
    };
  }
  const json = await getJson<Record<string, any>>(
    `https://www.pricecharting.com/api/product?t=${token}&q=${encodeURIComponent(query)}`,
  );
  const cents = json?.["loose-price"] ?? json?.["cib-price"];
  const price = typeof cents === "number" && cents > 0 ? Number((cents / 100).toFixed(2)) : null;
  return {
    source: "pricecharting",
    price,
    currency: "USD",
    live: price != null,
    note: price == null ? "No PriceCharting match" : undefined,
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
  return language === "JP"
    ? ["ebay", "snkrdunk"]
    : ["tcgplayer", "ebay", "pricecharting"];
}

export async function quoteAll(card: {
  id: string;
  name: string;
  number: string;
  setName: string;
  language: string;
}): Promise<Quote[]> {
  const query = `${card.name} ${card.setName} ${card.number} pokemon card`;
  const wanted = sourcesFor(card.language);
  const runners: Record<PriceSource, () => Promise<Quote>> = {
    tcgplayer: () => quoteTcgplayer(card.id),
    ebay: () => quoteEbay(query),
    pricecharting: () => quotePriceCharting(query),
    snkrdunk: () => quoteSnkrdunk(card.nativeQuery ?? query),
  } as never;
  return Promise.all(wanted.map((s) => runners[s]()));
}
