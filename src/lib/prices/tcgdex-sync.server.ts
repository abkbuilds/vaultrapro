/**
 * TCGdex price backfill (server-only, keyless).
 *
 * TCGdex republishes Cardmarket's daily figures for English *and* Japanese
 * printings with no API key, covering many printings TCGplayer (tcgcsv) never
 * listed — classic JP sets, deck-only cards, regional promos.
 *
 * Everything written here is a real published Cardmarket reading converted to
 * USD at the ECB daily reference rate. Nothing is modelled or interpolated:
 * a card with no reading stays unpriced and the UI says "no data".
 */

const TCGDEX = "https://api.tcgdex.net/v2";

type CmBlock = Record<string, number | string | null>;

async function eurToUsd(): Promise<number> {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD", {
      headers: { accept: "application/json" },
    });
    const json = (await res.json()) as { rates?: { USD?: number } };
    const rate = json?.rates?.USD;
    if (typeof rate === "number" && rate > 0) return rate;
  } catch {
    /* fall through */
  }
  return 1.08;
}

function pick(block: CmBlock, keys: string[]): number | null {
  for (const k of keys) {
    const v = block[k];
    if (typeof v === "number" && v > 0) return Number(v.toFixed(2));
  }
  return null;
}

interface CardPricing {
  /** Current Cardmarket reading in EUR. */
  now: number | null;
  /** Real dated averages in EUR, oldest first. */
  seeds: { daysAgo: number; price: number }[];
}

/**
 * TCGdex ids look like `SET-NUMBER`. Our catalogue ids usually match once the
 * language prefix is stripped, but promos scraped from TCGplayer carry a
 * synthetic `tp-<productId>` id — for those we rebuild the id from set code
 * and card number.
 */
function tcgdexIds(card: { id: string; set_code: string | null; number: string }): string[] {
  const bare = card.id.replace(/^(jp|en)-/, "");
  const ids = [bare];
  const code = card.set_code?.toUpperCase();
  if (code) {
    const num = (card.number.split("/")[0] ?? card.number).trim();
    ids.push(`${code}-${num}`);
    const padded = num.replace(/^0+(?=\d)/, "").padStart(3, "0");
    if (padded !== num) ids.push(`${code}-${padded}`);
  }
  return [...new Set(ids.filter((i) => i && !i.startsWith("tp-")))];
}

async function fetchOne(cardId: string, jp: boolean): Promise<CardPricing | null> {
  const url = `${TCGDEX}/${jp ? "ja" : "en"}/cards/${cardId}`;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });

    if (!res.ok) return null;
    const json = (await res.json()) as { pricing?: { cardmarket?: CmBlock | null } };
    const block = json?.pricing?.cardmarket;
    if (!block) return null;
    const holo = typeof block["trend-holo"] === "number" && (block["trend-holo"] as number) > 0;
    const key = (base: string) => (holo ? `${base}-holo` : base);
    const now = pick(block, [key("trend"), "trend", key("avg"), "avg", "low"]);
    if (now == null) return null;
    const seeds: { daysAgo: number; price: number }[] = [];
    for (const [daysAgo, base] of [
      [30, "avg30"],
      [7, "avg7"],
      [1, "avg1"],
    ] as const) {
      const v = pick(block, [key(base), base]);
      if (v != null) seeds.push({ daysAgo, price: v });
    }
    return { now, seeds };
  } catch {
    return null;
  }
}

type CardRow = { id: string; set_code: string | null; number: string };

/** Tries each plausible TCGdex id until one returns a real Cardmarket reading. */
async function fetchPricing(card: CardRow): Promise<CardPricing | null> {
  const jp = card.id.startsWith("jp-");
  for (const id of tcgdexIds(card)) {
    const hit = await fetchOne(id, jp);
    if (hit) return hit;
  }
  return null;
}


export interface TcgdexSyncArgs {
  language: "EN" | "JP";
  limit: number;
  offset: number;
  /** Only price cards that currently have no market price. */
  onlyMissing: boolean;
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export async function runTcgdexSync(args: TcgdexSyncArgs) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let q = supabaseAdmin
    .from("tcg_cards")
    .select("id,set_code,number")
    .eq("language", args.language)
    .order("id", { ascending: true })
    .range(args.offset, args.offset + args.limit - 1);
  if (args.onlyMissing) q = q.is("market_price", null);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as unknown as CardRow[];

  const rate = await eurToUsd();
  const points: Record<string, unknown>[] = [];
  let priced = 0;

  // Small concurrency keeps the public API happy while staying fast enough
  // to walk tens of thousands of cards over repeated calls.
  const CONCURRENCY = 8;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (row) => ({ id: row.id, pricing: await fetchPricing(row) })),
    );

    for (const { id, pricing } of results) {
      if (!pricing || pricing.now == null) continue;
      const usd = Number((pricing.now * rate).toFixed(2));
      priced++;
      await supabaseAdmin
        .from("tcg_cards")
        .update({ market_price: usd, updated_at: new Date().toISOString() } as never)
        .eq("id", id);
      points.push({
        card_id: id,
        source: "cardmarket",
        condition: "Near Mint",
        price: usd,
        currency: "USD",
        captured_on: new Date().toISOString().slice(0, 10),
      });
      for (const seed of pricing.seeds) {
        points.push({
          card_id: id,
          source: "cardmarket",
          condition: "Near Mint",
          price: Number((seed.price * rate).toFixed(2)),
          currency: "USD",
          captured_on: isoDaysAgo(seed.daysAgo),
        });
      }
    }
  }

  for (let i = 0; i < points.length; i += 500) {
    await supabaseAdmin.from("card_price_points").upsert(points.slice(i, i + 500) as never, {
      onConflict: "card_id,source,condition,captured_on",
      ignoreDuplicates: true,
    });
  }

  return {
    ok: true,
    scanned: rows.length,
    priced,
    pointsCaptured: points.length,
    nextOffset: args.onlyMissing ? args.offset : args.offset + rows.length,
    done: rows.length < args.limit,
  };
}
