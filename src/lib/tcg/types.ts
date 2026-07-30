export type Language = "EN" | "JP";

export type Condition =
  | "Mint"
  | "Near Mint"
  | "Lightly Played"
  | "Moderately Played"
  | "Heavily Played"
  | "Damaged";

export const CONDITIONS: Condition[] = [
  "Mint",
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged",
];

export const CONDITION_MULTIPLIER: Record<Condition, number> = {
  Mint: 1.25,
  "Near Mint": 1,
  "Lightly Played": 0.82,
  "Moderately Played": 0.62,
  "Heavily Played": 0.42,
  Damaged: 0.25,
};

export type PriceSource = "tcgplayer" | "ebay" | "snkrdunk" | "pricecharting";

export type TimeRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "5Y" | "ALL";

export interface TcgCard {
  id: string;
  name: string;
  /** Original printed name, for Japanese cards */
  nativeName?: string;
  game: GameId;
  language: Language;
  setName: string;
  setCode: string;
  number: string;
  rarity: string;
  type?: string;
  hp?: number;
  artist?: string;
  image: string;
  marketPrice: number;
  change7d: number;
  variants?: string[];
}

export type GameId = "pokemon" | "magic" | "onepiece" | "lorcana" | "yugioh";

export interface GameMeta {
  id: GameId;
  name: string;
  short: string;
}

export const GAMES: GameMeta[] = [
  { id: "pokemon", name: "Pokémon", short: "PKM" },
  { id: "magic", name: "Magic: The Gathering", short: "MTG" },
  { id: "onepiece", name: "One Piece", short: "OP" },
  { id: "lorcana", name: "Lorcana", short: "LOR" },
  { id: "yugioh", name: "Yu-Gi-Oh!", short: "YGO" },
];

export interface PricePoint {
  date: string;
  value: number;
}

export interface Listing {
  id: string;
  date: string;
  source: PriceSource;
  condition: Condition;
  price: number;
  kind: "sale" | "listing" | "buyback";
}

export interface CollectionEntry {
  id: string;
  cardId: string;
  quantity: number;
  condition: Condition;
  purchasePrice: number;
  addedAt: string;
}

export const SOURCE_META: Record<
  PriceSource,
  { label: string; color: string; languages: Language[] }
> = {
  tcgplayer: { label: "TCGplayer", color: "var(--src-tcgplayer)", languages: ["EN"] },
  ebay: { label: "eBay sold", color: "var(--src-ebay)", languages: ["EN", "JP"] },
  snkrdunk: { label: "snkrdunk", color: "var(--src-snkrdunk)", languages: ["JP"] },
  pricecharting: {
    label: "PriceCharting",
    color: "var(--src-pricecharting)",
    languages: ["EN"],
  },
};

export const RANGE_DAYS: Record<TimeRange, number> = {
  "1D": 1,
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "1Y": 365,
  ALL: 1095,
};
