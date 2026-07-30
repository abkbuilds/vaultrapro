import { supabase } from "@/integrations/supabase/client";
import type { TcgCard, Language } from "@/lib/tcg/types";
import { registerCards } from "@/lib/tcg/cards";

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
}

const SELECT =
  "id,language,name,native_name,set_id,set_name,set_code,number,rarity,types,hp,artist,image_small,image_large,market_price,is_promo";

export function toTcgCard(row: DbCard): TcgCard {
  return {
    id: row.id,
    name: row.name,
    nativeName: row.native_name ?? undefined,
    game: "pokemon",
    language: (row.language as Language) ?? "EN",
    setName: row.set_name,
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

export interface SearchArgs {
  query?: string;
  language?: "all" | Language;
  setId?: string;
  rarity?: string;
  promoOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export async function searchCards(args: SearchArgs) {
  const pageSize = args.pageSize ?? 40;
  const page = args.page ?? 0;
  let q = supabase
    .from("tcg_cards")
    .select(SELECT, { count: "estimated" })
    .order("release_date", { ascending: false, nullsFirst: false })
    .order("number", { ascending: true })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  const term = args.query?.trim().toLowerCase();
  if (term) q = q.ilike("search_text", `%${term}%`);
  if (args.language && args.language !== "all") q = q.eq("language", args.language);
  if (args.setId && args.setId !== "all") q = q.eq("set_id", args.setId);
  if (args.rarity && args.rarity !== "all") q = q.eq("rarity", args.rarity);
  if (args.promoOnly) q = q.eq("is_promo", true);

  const { data, error, count } = await q;
  if (error) throw error;
  const cards = ((data ?? []) as unknown as DbCard[]).map(toTcgCard);
  registerCards(cards);
  return { cards, total: count ?? cards.length };
}

export async function listSets(language: "all" | Language = "all") {
  let q = supabase
    .from("tcg_sets")
    .select("id,language,name,code,series,total,release_date,logo_url,symbol_url")
    .order("release_date", { ascending: false, nullsFirst: false })
    .limit(1000);
  if (language !== "all") q = q.eq("language", language);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as DbSet[];
}

export async function listRarities(language: "all" | Language = "all") {
  let q = supabase.from("tcg_cards").select("rarity").not("rarity", "is", null).limit(5000);
  if (language !== "all") q = q.eq("language", language);
  const { data, error } = await q;
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => (r as { rarity: string }).rarity))].sort();
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
  registerCards([card]);
  return card;
}

export async function fetchCardsByIds(ids: string[]): Promise<TcgCard[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("tcg_cards").select(SELECT).in("id", ids);
  if (error) throw error;
  const cards = ((data ?? []) as unknown as DbCard[]).map(toTcgCard);
  registerCards(cards);
  return cards;
}

export async function catalogStats() {
  const [cards, sets] = await Promise.all([
    supabase.from("tcg_cards").select("id", { count: "estimated", head: true }),
    supabase.from("tcg_sets").select("id", { count: "estimated", head: true }),
  ]);
  return { cards: cards.count ?? 0, sets: sets.count ?? 0 };
}
