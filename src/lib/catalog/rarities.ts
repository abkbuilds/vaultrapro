import type { Language } from "@/lib/tcg/types";

/**
 * Rarity buckets shown in the search filter. Each bucket maps the raw values
 * stored on the cards to the label collectors actually use in that market —
 * English words for English cards, the printed JP rarity codes for Japanese.
 */
export interface RarityBucket {
  /** Stable filter id, e.g. "JP:SAR" */
  id: string;
  language: Language;
  label: string;
  /** Raw `tcg_cards.rarity` values that belong to this bucket. */
  values: string[];
}

const EN_BUCKETS: { label: string; values: string[] }[] = [
  { label: "Common", values: ["Common"] },
  { label: "Uncommon", values: ["Uncommon"] },
  { label: "Rare", values: ["Rare", "Rare Holo", "Rare Prime", "Rare BREAK", "Rare Holo Star"] },
  { label: "Double Rare", values: ["Double Rare"] },
  {
    label: "Ultra Rare",
    values: [
      "Ultra Rare",
      "Rare Ultra",
      "Rare Holo EX",
      "Rare Holo GX",
      "Rare Holo V",
      "Rare Holo VMAX",
      "Rare Holo VSTAR",
      "Rare Holo LV.X",
      "Shiny Ultra Rare",
      "LEGEND",
    ],
  },
  { label: "Illustration Rare", values: ["Illustration Rare"] },
  { label: "Special Illustration Rare", values: ["Special Illustration Rare"] },
  { label: "Hyper Rare", values: ["Hyper Rare", "Rare Rainbow", "Mega Hyper Rare"] },
  { label: "ACE SPEC Rare", values: ["ACE SPEC Rare", "Rare ACE"] },
  { label: "Radiant Pokémon", values: ["Radiant Rare"] },
  { label: "Amazing Rare", values: ["Amazing Rare"] },
  {
    label: "Secret Rare",
    values: ["Rare Secret", "Black White Rare", "Classic Collection"],
  },
  {
    label: "Shiny Rare",
    values: ["Rare Shiny", "Shiny Rare", "Rare Shiny GX", "Rare Shining"],
  },
  { label: "Prism Star", values: ["Rare Prism Star"] },
  { label: "Trainer Gallery", values: ["Trainer Gallery Rare Holo"] },
  { label: "Mega Attack Rare", values: ["Mega Attack Rare"] },
  { label: "Promo", values: ["Promo"] },
];

const JP_BUCKETS: { label: string; values: string[] }[] = [
  { label: "C — Common", values: ["Common"] },
  { label: "U — Uncommon", values: ["Uncommon"] },
  { label: "R — Rare", values: ["Rare", "Holo Rare"] },
  { label: "RR — Double Rare", values: ["Double Rare"] },
  { label: "RRR — Triple Rare", values: ["Triple Rare"] },
  { label: "AR — Art Rare", values: ["Art Rare"] },
  { label: "SR — Super Rare", values: ["Super Rare", "Super Rare Holo"] },
  { label: "SAR — Special Art Rare", values: ["Special Art Rare"] },
  { label: "UR — Ultra/Hyper Rare", values: ["Ultra Rare", "Hyper Rare"] },
  { label: "MUR — Mega Ultra Rare", values: ["Mega Ultra Rare"] },
  { label: "S — Shiny Rare", values: ["Shiny Rare", "Shining"] },
  { label: "SSR — Shiny Super Rare", values: ["Shiny Secret Rare"] },
  { label: "CHR — Character Rare", values: ["Character Rare"] },
  { label: "CSR — Character Super Rare", values: ["Character Super Rare"] },
  { label: "ACE SPEC", values: ["ACE Rare"] },
  { label: "K — Radiant (Kagayaku)", values: ["Kagayaku"] },
  { label: "TR — Trainer Rare", values: ["Trainer Rare"] },
  { label: "PR — Prism Rare", values: ["Prism Rare"] },
  { label: "A — Amazing Rare", values: ["Amazing Rare"] },
  { label: "LEGEND", values: ["Rare Holo LEGEND"] },
  { label: "PROMO", values: ["Promo"] },
];

function code(label: string) {
  return label.replace(/[^A-Za-z0-9]+/g, "-").toUpperCase();
}

const ALL: RarityBucket[] = [
  ...EN_BUCKETS.map((b) => ({ id: `EN:${code(b.label)}`, language: "EN" as Language, ...b })),
  ...JP_BUCKETS.map((b) => ({ id: `JP:${code(b.label)}`, language: "JP" as Language, ...b })),
];

export const RARITY_BUCKETS = ALL;

const BY_ID = new Map(ALL.map((b) => [b.id, b]));

export function bucketById(id: string) {
  return BY_ID.get(id);
}

/** Buckets that have at least one raw rarity actually present in the catalogue. */
export function bucketsFor(language: "all" | Language, present: Set<string>) {
  return ALL.filter(
    (b) =>
      (language === "all" || b.language === language) &&
      b.values.some((v) => present.has(`${b.language}|${v}`)),
  );
}
