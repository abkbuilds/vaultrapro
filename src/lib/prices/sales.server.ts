/**
 * Completed-sale ingestion and market price calculation (server-only).
 *
 * A "sale" here is one real, completed transaction with a timestamp, a price
 * and a link back to the source listing. Nothing is modelled: when no source
 * can supply completed sales for a card, the market price is `null` and the UI
 * says so.
 *
 * Adding a marketplace means adding one entry to `SALE_ADAPTERS` — no UI or
 * database change is required.
 */
import type { PriceSource } from "@/lib/tcg/types";
import { supabase } from "@/integrations/supabase/client";
import type { CardLike } from "./history.server";

export interface RawSale {
  source: PriceSource;
  /** Stable id from the marketplace, used to de-duplicate repeated syncs. */
  externalId: string;
  soldAt: string;
  price: number;
  currency: string;
  priceUsd: number | null;
  condition?: string | null;
  title?: string | null;
  url?: string | null;
}

export interface SaleFeed {
  source: PriceSource;
  sales: RawSale[];
  /** Present when the source could not be queried (missing key, no match…). */
  unavailable?: string;
}

const FX: Record<string, number> = { USD: 1 };

async function toUsd(amount: number, currency: string): Promise<number | null> {
  if (currency === "USD") return Number(amount.toFixed(2));
  const cached = FX[currency];
  if (cached) return Number((amount * cached).toFixed(2));
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${currency}&to=USD`);
    if (!res.ok) return null;
    const json = (await res.json()) as { rates?: { USD?: number } };
    const rate = json.rates?.USD;
    if (!rate) return null;
    FX[currency] = rate;
    return Number((amount * rate).toFixed(2));
  } catch {
    return null;
  }
}

/* ---------------------------------- eBay --------------------------------- */

let ebayToken: { value: string; expires: number } | null = null;

async function ebayAccessToken(scope: string): Promise<string | null> {
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
      body: `grant_type=client_credentials&scope=${encodeURIComponent(scope)}`,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token: string; expires_in: number };
    ebayToken = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
    return ebayToken.value;
  } catch {
    return null;
  }
}

/** eBay Marketplace Insights: last 90 days of completed sales. */
async function ebaySales(card: CardLike): Promise<SaleFeed> {
  const token = await ebayAccessToken(
    "https://api.ebay.com/oauth/api_scope/buy.marketplace.insights",
  );
  if (!token) {
    return {
      source: "ebay",
      sales: [],
      unavailable: "Add eBay API credentials to ingest completed sales",
    };
  }
  const q = `${card.name} ${card.number} ${card.language === "JP" ? "japanese" : ""} pokemon card`;
  try {
    const res = await fetch(
      `https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search?limit=20&q=${encodeURIComponent(q)}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": card.language === "JP" ? "EBAY_US" : "EBAY_US",
        },
      },
    );
    if (!res.ok) {
      return { source: "ebay", sales: [], unavailable: `eBay returned ${res.status}` };
    }
    const json = (await res.json()) as { itemSales?: any[] };
    const sales: RawSale[] = [];
    for (const item of json.itemSales ?? []) {
      const price = Number(item?.lastSoldPrice?.value);
      const currency = String(item?.lastSoldPrice?.currency ?? "USD");
      const soldAt = item?.lastSoldDate;
      if (!Number.isFinite(price) || price <= 0 || !soldAt) continue;
      sales.push({
        source: "ebay",
        externalId: String(item.itemId ?? `${soldAt}-${price}`),
        soldAt: new Date(soldAt).toISOString(),
        price: Number(price.toFixed(2)),
        currency,
        priceUsd: await toUsd(price, currency),
        condition: item?.condition ?? null,
        title: item?.title ?? null,
        url: item?.itemWebUrl ?? null,
      });
    }
    return {
      source: "ebay",
      sales,
      unavailable: sales.length ? undefined : "No completed eBay sales matched this card",
    };
  } catch {
    return { source: "ebay", sales: [], unavailable: "eBay request failed" };
  }
}

/* -------------------------------- snkrdunk ------------------------------- */

async function snkrdunkSales(card: CardLike): Promise<SaleFeed> {
  const token = process.env.SNKRDUNK_API_TOKEN;
  if (!token) {
    return {
      source: "snkrdunk",
      sales: [],
      unavailable: "snkrdunk has no public API — a partner token is required",
    };
  }
  try {
    const res = await fetch(
      `https://snkrdunk.com/api/v1/trading-cards/search?keyword=${encodeURIComponent(card.name)}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return { source: "snkrdunk", sales: [], unavailable: "snkrdunk request failed" };
    const json = (await res.json()) as Record<string, any>;
    const items: any[] = json?.sales ?? json?.items ?? [];
    const sales: RawSale[] = [];
    for (const s of items) {
      const yen = Number(s?.price ?? s?.soldPrice);
      const date = s?.soldAt ?? s?.tradedAt;
      if (!Number.isFinite(yen) || yen <= 0 || !date) continue;
      sales.push({
        source: "snkrdunk",
        externalId: String(s.id ?? `${date}-${yen}`),
        soldAt: new Date(date).toISOString(),
        price: yen,
        currency: "JPY",
        priceUsd: await toUsd(yen, "JPY"),
        condition: s?.condition ?? null,
        title: s?.name ?? null,
        url: s?.url ?? null,
      });
    }
    return {
      source: "snkrdunk",
      sales,
      unavailable: sales.length ? undefined : "No recent snkrdunk sales",
    };
  } catch {
    return { source: "snkrdunk", sales: [], unavailable: "snkrdunk request failed" };
  }
}

/** Plug new marketplaces in here — everything downstream is source-agnostic. */
export const SALE_ADAPTERS: Record<
  PriceSource,
  ((card: CardLike) => Promise<SaleFeed>) | null
> = {
  ebay: ebaySales,
  pricecharting: null, // removed — no live PriceCharting feed
  snkrdunk: snkrdunkSales,
  tcgplayer: null, // aggregate market data only, no per-sale feed
  cardmarket: null,
};

export function saleSourcesFor(language: string): PriceSource[] {
  return language === "JP" ? ["ebay", "snkrdunk"] : ["ebay"];
}

/* -------------------------------- ingestion ------------------------------ */

export async function ingestSales(card: CardLike) {
  const adapters = saleSourcesFor(card.language)
    .map((s) => [s, SALE_ADAPTERS[s]] as const)
    .filter(([, fn]) => fn);
  const feeds = await Promise.all(adapters.map(([, fn]) => fn!(card)));

  const rows = feeds
    .flatMap((f) => f.sales)
    .map((s) => ({
      card_id: card.id,
      source: s.source,
      external_id: s.externalId,
      sold_at: s.soldAt,
      price: s.price,
      currency: s.currency,
      price_usd: s.priceUsd,
      condition: s.condition ?? null,
      title: s.title ?? null,
      url: s.url ?? null,
    }));

  if (rows.length) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("card_sales")
      .upsert(rows, { onConflict: "source,external_id" });
  }
  return { inserted: rows.length, feeds: feeds.map((f) => ({ source: f.source, unavailable: f.unavailable })) };
}

/* -------------------------- reads + market price ------------------------- */

export interface SaleRow {
  id: string;
  source: PriceSource;
  soldAt: string;
  price: number;
  currency: string;
  priceUsd: number | null;
  condition: string | null;
  title: string | null;
  url: string | null;
}

export interface MarketPrice {
  /** Average of the most recent completed sales, in USD. */
  value: number | null;
  /** How many sales the average is based on (max 10). */
  sampleSize: number;
  /** Fewer than 5 sales — shown to the user as low confidence. */
  lowConfidence: boolean;
  windowStart: string | null;
  windowEnd: string | null;
}

/** Most recent completed sales for a card, newest first. */
export async function getSales(cardId: string, limit = 50): Promise<SaleRow[]> {
  const { data } = await supabase
    .from("card_sales")
    .select("id,source,sold_at,price,currency,price_usd,condition,title,url")
    .eq("card_id", cardId)
    .order("sold_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    source: r.source as PriceSource,
    soldAt: r.sold_at,
    price: Number(r.price),
    currency: r.currency,
    priceUsd: r.price_usd == null ? null : Number(r.price_usd),
    condition: r.condition,
    title: r.title,
    url: r.url,
  }));
}

/**
 * Market price = mean of the last 5–10 completed sales (USD). With fewer than
 * five sales we still average what exists but flag it as low confidence; with
 * none we return null rather than inventing a number.
 */
export function marketPriceFrom(sales: SaleRow[]): MarketPrice {
  const usable = sales.filter((s) => s.priceUsd != null).slice(0, 10);
  if (!usable.length) {
    return {
      value: null,
      sampleSize: 0,
      lowConfidence: true,
      windowStart: null,
      windowEnd: null,
    };
  }
  const sum = usable.reduce((acc, s) => acc + (s.priceUsd as number), 0);
  return {
    value: Number((sum / usable.length).toFixed(2)),
    sampleSize: usable.length,
    lowConfidence: usable.length < 5,
    windowStart: usable.at(-1)!.soldAt,
    windowEnd: usable[0].soldAt,
  };
}

export async function getMarketPrice(cardId: string): Promise<MarketPrice> {
  return marketPriceFrom(await getSales(cardId, 10));
}
