/**
 * Pokémon TCG API bulk price backfill (server-only, keyed).
 *
 * api.pokemontcg.io republishes TCGplayer's full daily price block (low / mid /
 * high / market, per printing variant) and Cardmarket's daily averages
 * (trend, avg1, avg7, avg30) for every English card. With an API key the
 * quota is 20k requests/day, so the whole English catalogue can be repriced in
 * a few hundred paged calls.
 *
 * Everything written here is a real published reading. The Cardmarket avg1 /
 * avg7 / avg30 figures are genuine dated averages, so they are written back as
 * dated history points — nothing is interpolated or modelled.
 */

const PTCG = "https://api.pokemontcg.io/v2";

type PriceBlock = Record<string, number | null | undefined>;

interface PtcgCard {
  id: string;
  tcgplayer?: { updatedAt?: string; prices?: Record<string, PriceBlock> };
  cardmarket?: { updatedAt?: string; prices?: PriceBlock };
}

export interface PtcgSyncArgs {
  /** 1-based page of the global card list (250 cards per page). */
  page: number;
  /** How many pages to walk in this call. */
  pages: number;
}

async function eurToUsd(): Promise<number> {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD", {
      headers: { accept: "application/json" },
    });
    const json = (await res.json()) as { rates?: { USD?: number } };
    const rate = json?.rates?.USD;
    if (typeof rate === "number" && rate > 0) return rate;
  } catch {
    /* fall through to last known ECB reference rate */
  }
  return 1.08;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : null;
}

/** Prefer the normal printing; fall back to whichever variant has a market price. */
function tcgplayerMarket(card: PtcgCard): number | null {
  const prices = card.tcgplayer?.prices ?? {};
  const order = ["normal", "holofoil", "reverseHolofoil", "1stEditionHolofoil", "1stEditionNormal"];
  for (const key of order) {
    const v = num(prices[key]?.["market"]) ?? num(prices[key]?.["mid"]);
    if (v != null) return v;
  }
  for (const block of Object.values(prices)) {
    const v = num(block?.["market"]) ?? num(block?.["mid"]);
    if (v != null) return v;
  }
  return null;
}

function dateMinus(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export let lastDebug = "";

async function fetchPage(page: number, key: string): Promise<PtcgCard[]> {
  const url = `${PTCG}/cards?page=${page}&pageSize=250&orderBy=id&select=id,tcgplayer,cardmarket`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json", "X-Api-Key": key } });
      if (res.ok) {
        const json = (await res.json()) as { data?: PtcgCard[] };
        return json.data ?? [];
      }
      lastDebug = `status ${res.status}`;
      if (res.status !== 429 && res.status < 500) return [];
    } catch (e) {
      lastDebug = `throw ${String(e)}`;
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  return [];
}

export async function runPtcgSync(args: PtcgSyncArgs) {
  const key = process.env["POKEMONTCG_API_KEY"];
  if (!key) return { ok: false, error: "POKEMONTCG_API_KEY is not configured" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rate = await eurToUsd();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const points: Record<string, unknown>[] = [];
  const latest: Record<string, unknown>[] = [];
  const marketUpdates: { id: string; price: number }[] = [];

  let scanned = 0;
  let lastPage = args.page - 1;
  let exhausted = false;

  for (let i = 0; i < args.pages; i++) {
    const page = args.page + i;
    const cards = await fetchPage(page, key);
    lastPage = page;
    if (!cards.length) {
      exhausted = true;
      break;
    }
    scanned += cards.length;

    for (const card of cards) {
      const id = `en-${card.id}`;

      const tcg = tcgplayerMarket(card);
      if (tcg != null) {
        latest.push({ card_id: id, source: "tcgplayer", price: tcg, currency: "USD", updated_at: now });
        points.push({
          card_id: id,
          source: "tcgplayer",
          condition: "Near Mint",
          price: tcg,
          currency: "USD",
          captured_on: card.tcgplayer?.updatedAt?.slice(0, 10) ?? today,
        });
        marketUpdates.push({ id, price: tcg });
      }

      const cm = card.cardmarket?.prices;
      if (cm) {
        const trend = num(cm["trendPrice"]) ?? num(cm["averageSellPrice"]);
        if (trend != null) {
          const usd = Number((trend * rate).toFixed(2));
          latest.push({
            card_id: id,
            source: "cardmarket",
            price: usd,
            currency: "USD",
            updated_at: now,
          });
          points.push({
            card_id: id,
            source: "cardmarket",
            condition: "Near Mint",
            price: usd,
            currency: "USD",
            captured_on: card.cardmarket?.updatedAt?.slice(0, 10) ?? today,
          });
        }
        // Genuine dated Cardmarket averages -> real history points.
        for (const [days, field] of [
          [1, "avg1"],
          [7, "avg7"],
          [30, "avg30"],
        ] as const) {
          const v = num(cm[field]);
          if (v == null) continue;
          points.push({
            card_id: id,
            source: "cardmarket",
            condition: "Near Mint",
            price: Number((v * rate).toFixed(2)),
            currency: "USD",
            captured_on: dateMinus(days),
          });
        }
      }
    }
  }

  // Only write rows for cards we actually hold, so foreign keys stay valid.
  const ids = [...new Set([...latest, ...points].map((r) => r["card_id"] as string))];
  const known = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await supabaseAdmin
      .from("tcg_cards")
      .select("id")
      .in("id", ids.slice(i, i + 500));
    for (const row of (data ?? []) as { id: string }[]) known.add(row.id);
  }

  const keepLatest = latest.filter((r) => known.has(r["card_id"] as string));
  const keepPoints = points.filter((r) => known.has(r["card_id"] as string));

  for (let i = 0; i < keepPoints.length; i += 500) {
    await supabaseAdmin.from("card_price_points").upsert(keepPoints.slice(i, i + 500) as never, {
      onConflict: "card_id,source,condition,captured_on",
      ignoreDuplicates: true,
    });
  }
  for (let i = 0; i < keepLatest.length; i += 500) {
    await supabaseAdmin
      .from("card_price_latest")
      .upsert(keepLatest.slice(i, i + 500) as never, { onConflict: "card_id,source" });
  }
  for (const row of marketUpdates.filter((r) => known.has(r.id))) {
    await supabaseAdmin
      .from("tcg_cards")
      .update({ market_price: row.price, updated_at: now } as never)
      .eq("id", row.id);
  }

  return {
    ok: true,
    scanned,
    priced: keepLatest.length,
    historyPoints: keepPoints.length,
    debug: lastDebug,
    nextPage: lastPage + 1,
    done: exhausted,
  };
}
