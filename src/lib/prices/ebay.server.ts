/**
 * eBay price adapter (server-only).
 *
 * Uses the eBay Browse API with application (client-credentials) tokens minted
 * from EBAY_CLIENT_ID + EBAY_CLIENT_SECRET. Browse returns *active* listings,
 * so a quote here is the trimmed median asking price of the closest matching
 * listings — never a modelled or estimated number. When nothing matches, the
 * quote is null and the UI says "no data".
 *
 * Completed-sale data (Marketplace Insights) is a restricted eBay API and is
 * only used when the account has been granted that scope; see sales.server.ts.
 */

const OAUTH_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
/** eBay leaf category: CCG Individual Cards. Keeps sealed product out. */
const CCG_SINGLES_CATEGORY = "183454";

let token: { value: string; expires: number } | null = null;

export async function ebayAppToken(): Promise<string | null> {
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (token && token.expires > Date.now() + 60_000) return token.value;
  try {
    const res = await fetch(OAUTH_URL, {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${id}:${secret}`)}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token: string; expires_in: number };
    token = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
    return token.value;
  } catch {
    return null;
  }
}

export interface EbayCardRef {
  name: string;
  number: string;
  setName?: string;
  setCode?: string;
  language?: string;
}

/** Card numbers are often written `25/102`; eBay listings use either half. */
function numberVariants(raw: string) {
  const n = raw.trim();
  const head = (n.split("/")[0] ?? n).trim();
  const unpadded = head.replace(/^0+(?=\d)/, "");
  return [...new Set([n, head, unpadded].filter(Boolean))];
}

export function ebayQuery(card: EbayCardRef) {
  const num = numberVariants(card.number)[0] ?? card.number;
  const jp = card.language === "JP" ? "japanese" : "";
  return [card.name, num, card.setName ?? card.setCode ?? "", jp, "pokemon card"]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trimmed median: drop the cheapest and dearest 20% (damaged lots, graded
 * slabs, mispriced listings) before taking the middle value.
 */
export function trimmedMedian(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const cut = sorted.length >= 5 ? Math.floor(sorted.length * 0.2) : 0;
  const core = sorted.slice(cut, sorted.length - cut);
  const mid = Math.floor(core.length / 2);
  const v = core.length % 2 ? core[mid] : (core[mid - 1] + core[mid]) / 2;
  return Number(v.toFixed(2));
}

export interface EbayQuote {
  price: number | null;
  currency: string;
  live: boolean;
  note?: string;
  /** How many listings the median was taken from. */
  sample: number;
}

/**
 * Live eBay reading for one card. Matching is deliberately strict: the card
 * number must appear in the listing title, otherwise a search for "Pikachu"
 * would price every Pikachu ever printed.
 */
export async function ebayCardQuote(card: EbayCardRef): Promise<EbayQuote> {
  const access = await ebayAppToken();
  if (!access) {
    return {
      price: null,
      currency: "USD",
      live: false,
      sample: 0,
      note: "eBay credentials are not configured",
    };
  }

  const params = new URLSearchParams({
    q: ebayQuery(card),
    limit: "50",
    category_ids: CCG_SINGLES_CATEGORY,
    filter: "buyingOptions:{FIXED_PRICE},priceCurrency:USD",
  });

  try {
    const res = await fetch(`${BROWSE_URL}?${params.toString()}`, {
      headers: {
        authorization: `Bearer ${access}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
    });
    if (!res.ok) {
      return {
        price: null,
        currency: "USD",
        live: false,
        sample: 0,
        note: `eBay returned ${res.status}`,
      };
    }
    const json = (await res.json()) as {
      itemSummaries?: { title?: string; price?: { value?: string; currency?: string } }[];
    };
    const variants = numberVariants(card.number);
    const nameToken = card.name.toLowerCase().split(/\s+/)[0] ?? "";

    const values: number[] = [];
    for (const item of json.itemSummaries ?? []) {
      const title = (item.title ?? "").toLowerCase();
      if (nameToken && !title.includes(nameToken)) continue;
      if (!variants.some((v) => title.includes(v.toLowerCase()))) continue;
      // Graded slabs trade on a different curve than raw singles.
      if (/\b(psa|bgs|cgc|ace)\s*\d/.test(title)) continue;
      if (/\b(lot|bundle|proxy|custom|sealed|booster box)\b/.test(title)) continue;
      const value = Number(item.price?.value);
      if (Number.isFinite(value) && value > 0) values.push(value);
    }

    const price = trimmedMedian(values);
    return {
      price,
      currency: "USD",
      live: price != null,
      sample: values.length,
      note:
        price == null
          ? "No matching raw eBay listings"
          : `Trimmed median of ${values.length} live listings`,
    };
  } catch {
    return { price: null, currency: "USD", live: false, sample: 0, note: "eBay request failed" };
  }
}
