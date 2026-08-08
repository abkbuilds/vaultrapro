/**
 * eBay bulk price backfill (server-only).
 *
 * Walks the catalogue and writes a real eBay reading (trimmed median of live
 * raw singles listings) into `card_price_points` and `card_price_latest` for
 * every card eBay actually lists. Cards with no match are left untouched so
 * they keep honestly reporting "no data".
 *
 * eBay's Browse API allows ~5,000 application calls per day, so this is
 * deliberately resumable: call it repeatedly with an increasing `offset`
 * (or on a cron) until `done` is true.
 */
import { ebayCardQuote } from "./ebay.server";

export interface EbaySyncArgs {
  language: "EN" | "JP";
  limit: number;
  offset: number;
  /** Only price cards that have no eBay reading yet. */
  onlyMissing: boolean;
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

export async function runEbaySync(args: EbaySyncArgs) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("tcg_cards")
    .select("id,name,english_name,number,set_name,set_code,language")
    .eq("language", args.language)
    .order("id", { ascending: true })
    .range(args.offset, args.offset + args.limit - 1);
  if (error) return { ok: false, error: error.message };

  let rows = (data ?? []) as unknown as CardRow[];
  const scanned = rows.length;

  if (args.onlyMissing && rows.length) {
    const { data: existing } = await supabaseAdmin
      .from("card_price_latest")
      .select("card_id")
      .eq("source", "ebay")
      .in(
        "card_id",
        rows.map((r) => r.id),
      );
    const seen = new Set(((existing ?? []) as { card_id: string }[]).map((r) => r.card_id));
    rows = rows.filter((r) => !seen.has(r.id));
  }

  const today = new Date().toISOString().slice(0, 10);
  const points: Record<string, unknown>[] = [];
  const latest: Record<string, unknown>[] = [];

  // eBay throttles hard on bursts; a small window keeps us well inside limits.
  const CONCURRENCY = 4;
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
    scanned,
    attempted: rows.length,
    priced: latest.length,
    nextOffset: args.offset + scanned,
    done: scanned < args.limit,
  };
}
