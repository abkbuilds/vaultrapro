import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CARD_BY_ID } from "./cards";
import type { CollectionEntry, Condition, TcgCard } from "./types";
import { CONDITION_MULTIPLIER } from "./types";

const KEY = "vaultcard.collection.v1";
const WISH_KEY = "vaultcard.wishlist.v1";

const SEED: CollectionEntry[] = [
  { id: "s1", cardId: "base1-4", quantity: 1, condition: "Lightly Played", purchasePrice: 320, addedAt: "2025-11-02" },
  { id: "s2", cardId: "swsh7-215", quantity: 1, condition: "Near Mint", purchasePrice: 465, addedAt: "2026-01-18" },
  { id: "s3", cardId: "swsh4-44", quantity: 3, condition: "Near Mint", purchasePrice: 31.5, addedAt: "2026-03-04" },
  { id: "s4", cardId: "jp-s9-069", quantity: 2, condition: "Mint", purchasePrice: 52, addedAt: "2026-04-21" },
  { id: "s5", cardId: "sv2-269", quantity: 1, condition: "Near Mint", purchasePrice: 96, addedAt: "2026-05-30" },
  { id: "s6", cardId: "sv1-245", quantity: 1, condition: "Near Mint", purchasePrice: 94.5, addedAt: "2026-06-12" },
  { id: "s7", cardId: "jp-sv2p-091", quantity: 1, condition: "Near Mint", purchasePrice: 108, addedAt: "2026-07-08" },
];

interface Ctx {
  entries: CollectionEntry[];
  wishlist: string[];
  add: (cardId: string, condition: Condition, quantity?: number, purchasePrice?: number) => void;
  remove: (id: string) => void;
  toggleWishlist: (cardId: string) => void;
  isWishlisted: (cardId: string) => boolean;
}

const CollectionContext = createContext<Ctx | null>(null);

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<CollectionEntry[]>(SEED);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEntries(read(KEY, SEED));
    setWishlist(read(WISH_KEY, ["swsh12pt5-160"]));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(KEY, JSON.stringify(entries));
  }, [entries, hydrated]);
  useEffect(() => {
    if (hydrated) window.localStorage.setItem(WISH_KEY, JSON.stringify(wishlist));
  }, [wishlist, hydrated]);

  const add = useCallback(
    (cardId: string, condition: Condition, quantity = 1, purchasePrice?: number) => {
      setEntries((prev) => [
        {
          id: `${cardId}-${Date.now()}`,
          cardId,
          condition,
          quantity,
          purchasePrice: purchasePrice ?? CARD_BY_ID.get(cardId)?.marketPrice ?? 0,
          addedAt: new Date().toISOString().slice(0, 10),
        },
        ...prev,
      ]);
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const toggleWishlist = useCallback((cardId: string) => {
    setWishlist((prev) =>
      prev.includes(cardId) ? prev.filter((c) => c !== cardId) : [cardId, ...prev],
    );
  }, []);

  const isWishlisted = useCallback(
    (cardId: string) => wishlist.includes(cardId),
    [wishlist],
  );

  const value = useMemo(
    () => ({ entries, wishlist, add, remove, toggleWishlist, isWishlisted }),
    [entries, wishlist, add, remove, toggleWishlist, isWishlisted],
  );

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useCollection() {
  const ctx = useContext(CollectionContext);
  if (!ctx) throw new Error("useCollection must be used inside CollectionProvider");
  return ctx;
}

export interface ValuedEntry extends CollectionEntry {
  card: TcgCard;
  unitValue: number;
  value: number;
  cost: number;
  gain: number;
  gainPct: number;
}

export function valueEntries(entries: CollectionEntry[]): ValuedEntry[] {
  return entries.flatMap((e) => {
    const card = CARD_BY_ID.get(e.cardId);
    if (!card) return [];
    const unitValue = card.marketPrice * CONDITION_MULTIPLIER[e.condition];
    const value = unitValue * e.quantity;
    const cost = e.purchasePrice * e.quantity;
    return [
      {
        ...e,
        card,
        unitValue,
        value,
        cost,
        gain: value - cost,
        gainPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
      },
    ];
  });
}

export function portfolioSeries(total: number, days: number) {
  const out: { date: string; value: number }[] = [];
  let v = total * 0.78;
  const steps = Math.min(days, 90);
  for (let i = steps; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - (i * days) / steps);
    v += (total - total * 0.78) / steps + Math.sin(i * 1.7) * total * 0.006;
    out.push({ date: d.toISOString(), value: Number(v.toFixed(2)) });
  }
  out[out.length - 1].value = Number(total.toFixed(2));
  return out;
}
