/**
 * eBay bulk price backfill (server-only).
 *
 * Walks the catalogue and writes a real eBay reading (trimmed median of live
 * raw singles listings) into `card_price_points` and `card_price_latest` for
 * every card eBay actually lists. Cards with no match are left untouched so
 * they keep honestly reporting "no data".
 *
 * eBay's Browse API allows ~5,000 application calls per day, so the daily
 * budget is spent where it buys the most: cards no other feed can price, then
 * the most valuable cards without an eBay reading, then the stalest readings.
 */
import { ebayCardQuote } from "./ebay.server";

export type EbayStrategy = "unpriced" | "missing-ebay" | "refresh";

export interface EbaySyncArgs {
  language: "EN" | "JP";
  limit: number;
  /** Which slice of the catalogue this call should spend eBay calls on. */
  strategy: EbayStrategy;
}

type CardRow = {
  id: string;
  name: string;
  english_name: string | null;
  number: string;
  set_name: string;
  set_code: string | null;
  language: string;
};

/** eBay throttles bursts; this window stays comfortably inside the limits. */
const CONCURRENCY = 8;

export async function runEbaySync(args: EbaySyncArgs) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin.rpc("ebay_sync_candidates" as never, {
    _language: args.language,
    _strategy: args.strategy,
    _limit: args.limit,
  } as never);
  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as unknown as CardRow[];

  const today = new Date().toISOString().slice(0, 10);
  const points: Record<string, unknown>[] = [];
  const latest: Record<string, unknown>[] = [];

  const probes: Record<string, unknown>[] = [];

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (row) => ({
        row,
        quote: await ebayCardQuote({
          // JP cards are searched by their English name where we have one.
          name: row.english_name || row.name,
          number: row.number,
          setName: row.set_name,
          setCode: row.set_code ?? undefined,
          language: row.language,
        }),
      })),
    );

    for (const { row, quote } of results) {
      probes.push({
        card_id: row.id,
        probed_at: new Date().toISOString(),
        matched: quote.price != null,
      });
      if (quote.price == null) continue;
      points.push({
        card_id: row.id,
        source: "ebay",
        condition: "Near Mint",
        price: quote.price,
        currency: "USD",
        captured_on: today,
      });
      latest.push({
        card_id: row.id,
        source: "ebay",
        price: quote.price,
        currency: "USD",
        updated_at: new Date().toISOString(),
      });
    }
  }

  // Remember every attempt so the daily eBay quota isn't spent re-checking
  // cards eBay simply doesn't list.
  for (let i = 0; i < probes.length; i += 500) {
    await supabaseAdmin
      .from("ebay_probe_log")
      .upsert(probes.slice(i, i + 500) as never, { onConflict: "card_id" });
  }


  for (let i = 0; i < points.length; i += 500) {
    await supabaseAdmin.from("card_price_points").upsert(points.slice(i, i + 500) as never, {
      onConflict: "card_id,source,condition,captured_on",
      ignoreDuplicates: true,
    });
  }
  for (let i = 0; i < latest.length; i += 500) {
    await supabaseAdmin
      .from("card_price_latest")
      .upsert(latest.slice(i, i + 500) as never, { onConflict: "card_id,source" });
  }

  return {
    ok: true,
    strategy: args.strategy,
    attempted: rows.length,
    priced: latest.length,
    /** eBay calls consumed by this batch, for daily budget tracking. */
    calls: rows.length,
    done: rows.length === 0,
  };
}
