/**
 * Keyless TCGplayer price feed (server-only).
 *
 * Source: tcgcsv.com — a free, public mirror of the TCGplayer catalogue that
 * needs no API key and covers BOTH Pokémon categories:
 *   - category 3  = Pokémon (English)
 *   - category 85 = Pokémon Japan
 *
 * That makes it the one source that can price essentially every printing we
 * hold, English and Japanese alike, including promos. Everything returned here
 * is a real published TCGplayer market price — nothing is modelled or
 * interpolated. When a printing has no listing, we return null and the UI says
 * "no data".
 */

export const EN_CATEGORY = 3;
export const JP_CATEGORY = 85;

export interface CsvGroup {
  groupId: number;
  name: string;
  abbreviation: string | null;
  publishedOn: string | null;
}

interface CsvProduct {
  productId: number;
  name: string;
  cleanName: string;
  extendedData?: { name: string; value: string }[];
}

interface CsvPrice {
  productId: number;
  marketPrice: number | null;
  midPrice: number | null;
  lowPrice: number | null;
  subTypeName: string | null;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "curl/8.7.1" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

function base(category: number) {
  return `https://tcgcsv.com/tcgplayer/${category}`;
}

/** "001/190" -> "001"; "SWSH045" -> "SWSH045" */
export function baseNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split("/")[0].trim().split(/\s+/).pop() ?? "";
  return first || null;
}

/** Loose key so "001" and "1" match. */
export function numberKey(n: string | null | undefined): string {
  if (!n) return "";
  const s = n.trim().toUpperCase();
  const m = s.match(/^([A-Z]*)0*(\d+)([A-Z]*)$/);
  return m ? `${m[1]}${m[2]}${m[3]}` : s;
}

function ext(p: CsvProduct, key: string): string | null {
  return p.extendedData?.find((e) => e.name === key)?.value?.trim() || null;
}

export async function listGroups(category: number): Promise<CsvGroup[]> {
  return (await getJson<{ results: CsvGroup[] }>(`${base(category)}/groups`)).results;
}

/**
 * Best market price per printing in a group, keyed by loose card number.
 * Foil/normal sub-types are reduced to the highest published market price so a
 * card always shows the value collectors actually see quoted.
 */
export async function groupPricesByNumber(
  category: number,
  groupId: number,
): Promise<Map<string, number>> {
  const [products, prices] = await Promise.all([
    getJson<{ results: CsvProduct[] }>(`${base(category)}/${groupId}/products`),
    getJson<{ results: CsvPrice[] }>(`${base(category)}/${groupId}/prices`).catch(() => ({
      results: [] as CsvPrice[],
    })),
  ]);

  const priceOf = new Map<number, number>();
  for (const p of prices.results) {
    const v = p.marketPrice ?? p.midPrice ?? p.lowPrice;
    if (typeof v === "number" && v > 0) {
      const prev = priceOf.get(p.productId);
      if (prev == null || v > prev) priceOf.set(p.productId, Number(v.toFixed(2)));
    }
  }

  const byNumber = new Map<string, number>();
  for (const product of products.results) {
    const num = baseNumber(ext(product, "Number"));
    if (!num) continue;
    const price = priceOf.get(product.productId);
    if (price == null) continue;
    const key = numberKey(num);
    const prev = byNumber.get(key);
    if (prev == null || price > prev) byNumber.set(key, price);
  }
  return byNumber;
}

/* --------------------------- per-card live quote -------------------------- */

const CACHE_TTL_MS = 60 * 60 * 1000;
const groupCache = new Map<string, { at: number; prices: Map<string, number> }>();
const groupIndex = new Map<number, { at: number; byAbbr: Map<string, CsvGroup> }>();

async function groupsByAbbr(category: number) {
  const hit = groupIndex.get(category);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.byAbbr;
  const byAbbr = new Map<string, CsvGroup>();
  for (const g of await listGroups(category)) {
    if (g.abbreviation) byAbbr.set(g.abbreviation.toUpperCase(), g);
  }
  groupIndex.set(category, { at: Date.now(), byAbbr });
  return byAbbr;
}

/**
 * Live TCGplayer market price for a single printing, no API key required.
 * Works for Japanese cards too (TCGplayer lists JP singles under category 85).
 */
export async function tcgplayerMarketPrice(card: {
  setCode: string;
  number: string;
  language: string;
}): Promise<number | null> {
  const category = card.language === "JP" ? JP_CATEGORY : EN_CATEGORY;
  const abbr = card.setCode?.toUpperCase();
  if (!abbr) return null;
  try {
    const group = (await groupsByAbbr(category)).get(abbr);
    if (!group) return null;
    const cacheKey = `${category}:${group.groupId}`;
    let entry = groupCache.get(cacheKey);
    if (!entry || Date.now() - entry.at > CACHE_TTL_MS) {
      entry = { at: Date.now(), prices: await groupPricesByNumber(category, group.groupId) };
      groupCache.set(cacheKey, entry);
    }
    return entry.prices.get(numberKey(card.number)) ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------ bulk backfill ----------------------------- */

export interface PriceSyncResult {
  language: "EN" | "JP";
  setsProcessed: string[];
  cardsPriced: number;
  pointsCaptured: number;
  remainingSets: number;
  done: boolean;
}

/**
 * Walks TCGplayer groups for one language and writes real market prices onto
 * every matching card, plus a dated reading into `card_price_points` so the
 * price charts accumulate genuine history from day one.
 */
export async function runPriceSync(opts: {
  language?: "EN" | "JP";
  limit?: number;
  offset?: number;
}): Promise<PriceSyncResult> {
  const language = opts.language ?? "EN";
  const limit = opts.limit ?? 6;
  const offset = opts.offset ?? 0;
  const category = language === "JP" ? JP_CATEGORY : EN_CATEGORY;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const groups = (await listGroups(category)).filter((g) => g.abbreviation);

  const { data: setRows, error: setErr } = await supabaseAdmin
    .from("tcg_sets")
    .select("id,code")
    .eq("language", language);
  if (setErr) throw new Error(`set lookup failed: ${setErr.message}`);

  const setsByCode = new Map<string, string[]>();
  for (const s of (setRows ?? []) as { id: string; code: string | null }[]) {
    const code = (s.code ?? s.id.replace(/^(en|jp)-/, "")).toUpperCase();
    setsByCode.set(code, [...(setsByCode.get(code) ?? []), s.id]);
  }

  const matched = groups.filter((g) => setsByCode.has((g.abbreviation ?? "").toUpperCase()));
  const batch = matched.slice(offset, offset + limit);
  const today = new Date().toISOString().slice(0, 10);

  let cardsPriced = 0;
  let pointsCaptured = 0;
  const processed: string[] = [];

  for (const group of batch) {
    const abbr = (group.abbreviation ?? "").toUpperCase();
    try {
      const prices = await groupPricesByNumber(category, group.groupId);
      if (!prices.size) {
        processed.push(abbr);
        continue;
      }

      for (const setId of setsByCode.get(abbr) ?? []) {
        const cards: { id: string; number: string; market_price: number | null }[] = [];
        for (let from = 0; ; from += 1000) {
          const { data } = await supabaseAdmin
            .from("tcg_cards")
            .select("id,number,market_price")
            .eq("set_id", setId)
            .range(from, from + 999);
          const page = (data ?? []) as typeof cards;
          cards.push(...page);
          if (page.length < 1000) break;
        }

        const updates: { id: string; price: number }[] = [];
        for (const c of cards) {
          const price = prices.get(numberKey(c.number));
          if (price == null) continue;
          updates.push({ id: c.id, price });
        }

        for (let i = 0; i < updates.length; i += 200) {
          const chunk = updates.slice(i, i + 200);
          await Promise.all(
            chunk.map((u) =>
              supabaseAdmin
                .from("tcg_cards")
                .update({ market_price: u.price, updated_at: new Date().toISOString() } as never)
                .eq("id", u.id),
            ),
          );
          const { error } = await supabaseAdmin.from("card_price_points").upsert(
            chunk.map((u) => ({
              card_id: u.id,
              source: "tcgplayer",
              condition: "Near Mint",
              price: u.price,
              currency: "USD",
              captured_on: today,
            })) as never,
            { onConflict: "card_id,source,condition,captured_on" },
          );
          if (!error) pointsCaptured += chunk.length;
          cardsPriced += chunk.length;
        }
      }
      processed.push(abbr);
    } catch (e) {
      console.error(`price sync failed for ${abbr}`, e);
    }
  }

  const remaining = Math.max(0, matched.length - offset - batch.length);
  return {
    language,
    setsProcessed: processed,
    cardsPriced,
    pointsCaptured,
    remainingSets: remaining,
    done: remaining === 0,
  };
}
