/**
 * PokéWallet price backfill (server-only).
 *
 * Fills real TCGplayer/Cardmarket market prices onto catalogue cards that no
 * keyless feed could price. Resumable and rate-limit friendly (the free plan
 * allows 100 requests/hour), so it is meant to be called in small batches.
 */
import { pokewalletLookup, pokewalletEnabled } from "./pokewallet.server";

export interface PokewalletSyncArgs {
  language: "EN" | "JP";
  limit: number;
  offset: number;
  /** Only price cards that currently have no market price. */
  onlyMissing: boolean;
}

export async function runPokewalletSync(args: PokewalletSyncArgs) {
  if (!pokewalletEnabled()) {
    return { ok: false, error: "POKEWALLET_API_KEY is not configured" };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let q = supabaseAdmin
    .from("tcg_cards")
    .select("id,name,english_name,number,set_code,set_name,market_price")
    .eq("language", args.language)
    .order("id", { ascending: true })
    .range(args.offset, args.offset + args.limit - 1);
  if (args.onlyMissing) q = q.is("market_price", null);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    english_name: string | null;
    number: string;
    set_code: string | null;
  }[];

  const today = new Date().toISOString().slice(0, 10);
  const points: Record<string, unknown>[] = [];
  let priced = 0;

  for (const row of rows) {
    const match = await pokewalletLookup({
      id: row.id,
      name: row.english_name ?? row.name,
      number: row.number,
      setCode: row.set_code ?? undefined,
    });
    if (!match) continue;
    const usd = match.tcgplayerUsd;
    if (usd == null) continue;
    priced++;
    await supabaseAdmin
      .from("tcg_cards")
      .update({ market_price: usd, updated_at: new Date().toISOString() } as never)
      .eq("id", row.id);
    points.push({
      card_id: row.id,
      source: "tcgplayer",
      condition: "Near Mint",
      price: usd,
      currency: "USD",
      captured_on: today,
    });
  }

  if (points.length) {
    await supabaseAdmin.from("card_price_points").upsert(points as never, {
      onConflict: "card_id,source,condition,captured_on",
      ignoreDuplicates: true,
    });
  }

  return {
    ok: true,
    scanned: rows.length,
    priced,
    nextOffset: args.offset + rows.length,
    done: rows.length < args.limit,
  };
}
