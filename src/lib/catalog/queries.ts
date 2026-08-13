import { supabase } from "@/integrations/supabase/client";
import type { TcgCard, Language } from "@/lib/tcg/types";
import { registerCards } from "@/lib/tcg/cards";
import { bucketById, RARITY_BUCKETS, type RarityBucket } from "@/lib/catalog/rarities";


export interface DbCard {
  id: string;
  language: string;
  name: string;
  native_name: string | null;
  set_id: string | null;
  set_name: string;
  set_code: string | null;
  number: string;
  rarity: string | null;
  types: string[] | null;
  hp: number | null;
  artist: string | null;
  image_small: string | null;
  image_large: string | null;
  market_price: number | null;
  is_promo: boolean;
  english_name: string | null;
  english_set_name: string | null;
}

export interface DbSet {
  id: string;
  language: string;
  name: string;
  code: string | null;
  series: string | null;
  total: number | null;
  release_date: string | null;
  logo_url: string | null;
  symbol_url: string | null;
  english_name: string | null;
}

const SELECT =
  "id,language,name,english_name,native_name,set_id,set_name,english_set_name,set_code,number,rarity,types,hp,artist,image_small,image_large,market_price,is_promo";

export function toTcgCard(row: DbCard): TcgCard {
  return {
    id: row.id,
    // Japanese cards are surfaced under their English name; the printed
    // Japanese name is kept alongside it.
    name: row.english_name ?? row.name,
    nativeName: row.native_name ?? (row.english_name ? row.name : undefined),
    game: "pokemon",
    language: (row.language as Language) ?? "EN",
    setName: row.english_set_name ?? row.set_name,
    setCode: row.set_code ?? "",
    number: row.number,
    rarity: row.rarity ?? "—",
    type: row.types?.[0],
    hp: row.hp ?? undefined,
    artist: row.artist ?? undefined,
    image: row.image_large ?? row.image_small ?? "",
    // Real catalogue price only — 0 means "no data", never an estimate.
    marketPrice: row.market_price != null ? Number(Number(row.market_price).toFixed(2)) : 0,
    change7d: null,
  };
}

const SOURCE_RANK = ["tcgplayer", "cardmarket", "ebay", "snkrdunk"];

/**
 * Fills in each card's real observed 7-day movement from the recorded
 * readings. Cards with no earlier reading keep `null` and render "No data".
 */
export async function attachChanges(cards: TcgCard[]): Promise<TcgCard[]> {
  if (!cards.length) return cards;
  const { data } = await supabase
    .from("card_price_latest")
    .select("card_id,source,change_7d")
    .in(
      "card_id",
      cards.map((c) => c.id),
    )
    .not("change_7d", "is", null);

  const best = new Map<string, { rank: number; value: number }>();
  for (const row of (data ?? []) as { card_id: string; source: string; change_7d: number }[]) {
    const rank = SOURCE_RANK.indexOf(row.source);
    const cur = best.get(row.card_id);
    if (!cur || (rank >= 0 && rank < cur.rank)) {
      best.set(row.card_id, { rank: rank < 0 ? 99 : rank, value: Number(row.change_7d) });
    }
  }
  for (const card of cards) {
    const hit = best.get(card.id);
    if (hit) card.change7d = Number(hit.value.toFixed(2));
  }
  registerCards(cards);
  return cards;
}


export interface SearchArgs {
  query?: string;
  language?: "all" | Language;
  setId?: string;
  rarity?: string;
  promoOnly?: boolean;
  minPrice?: number | null;
  maxPrice?: number | null;
  page?: number;
  pageSize?: number;
}

export async function searchCards(args: SearchArgs) {
  const pageSize = args.pageSize ?? 40;
  const page = args.page ?? 0;
  let q = supabase
    .from("tcg_cards")
    // Exact count so the pager always reaches the last card in the catalogue.
    .select(SELECT, { count: "exact" })
    .order("release_date", { ascending: false, nullsFirst: false })
    .order("number", { ascending: true })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  const term = args.query?.trim().toLowerCase();
  if (term) {
    // Every word must appear somewhere in the searchable text, so
    // "umbreon sv4a 205" and "sv4a 205" both land on the right printing.
    for (const word of term.split(/\s+/).filter(Boolean).slice(0, 6)) {
      q = q.ilike("search_text", `%${word}%`);
    }
  }
  if (args.language && args.language !== "all") q = q.eq("language", args.language);
  if (args.setId && args.setId !== "all") q = q.eq("set_id", args.setId);
  if (args.rarity && args.rarity !== "all") {
    // Filter ids are market-facing rarity buckets (e.g. "JP:SAR"), each of
    // which covers one or more raw rarity strings.
    const bucket = bucketById(args.rarity);
    if (bucket) {
      q = q.in("rarity", bucket.values).eq("language", bucket.language);
    } else {
      q = q.eq("rarity", args.rarity);
    }
  }
  if (args.promoOnly) q = q.eq("is_promo", true);
  if (args.minPrice != null) q = q.gte("market_price", args.minPrice);
  if (args.maxPrice != null) q = q.lte("market_price", args.maxPrice);


  const { data, error, count } = await q;
  if (error) throw error;
  const cards = ((data ?? []) as unknown as DbCard[]).map(toTcgCard);
  await attachChanges(cards);
  return { cards, total: count ?? cards.length };

}

export async function listSets(language: "all" | Language = "all") {
  let q = supabase
    .from("tcg_sets")
    .select("id,language,name,english_name,code,series,total,release_date,logo_url,symbol_url")
    .order("release_date", { ascending: false, nullsFirst: false })
    .limit(1000);
  if (language !== "all") q = q.eq("language", language);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as DbSet[];
}

/**
 * Rarity choices for the search filter, expressed the way collectors read them
 * in each market (English words for EN, printed codes like SAR/CHR for JP).
 */
export function listRarities(language: "all" | Language = "all"): RarityBucket[] {
  return RARITY_BUCKETS.filter((b) => language === "all" || b.language === language);
}


export async function fetchCardById(id: string): Promise<TcgCard | null> {
  const { data, error } = await supabase
    .from("tcg_cards")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const card = toTcgCard(data as unknown as DbCard);
  await attachChanges([card]);
  return card;
}

export async function fetchCardsByIds(ids: string[]): Promise<TcgCard[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("tcg_cards").select(SELECT).in("id", ids);
  if (error) throw error;
  const cards = ((data ?? []) as unknown as DbCard[]).map(toTcgCard);
  await attachChanges(cards);
  return cards;

}

export async function catalogStats() {
  const [cards, sets] = await Promise.all([
    supabase.from("tcg_cards").select("id", { count: "estimated", head: true }),
    supabase.from("tcg_sets").select("id", { count: "estimated", head: true }),
  ]);
  return { cards: cards.count ?? 0, sets: sets.count ?? 0 };
}
