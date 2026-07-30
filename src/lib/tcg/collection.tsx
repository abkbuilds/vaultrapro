import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CARD_BY_ID } from "./cards";
import type { CollectionEntry, Condition, TcgCard } from "./types";
import { CONDITION_MULTIPLIER } from "./types";

const KEY = "vaultcard.collection.v1";
const WISH_KEY = "vaultcard.wishlist.v1";

/** No demo holdings — the portfolio only ever reflects what the user adds. */
const SEED: CollectionEntry[] = [];

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
    setWishlist(read(WISH_KEY, []));
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

/** Holdings shape the server needs to rebuild real portfolio history. */
export function holdingsOf(entries: CollectionEntry[]) {
  return entries.map((e) => ({
    cardId: e.cardId,
    quantity: e.quantity,
    multiplier: CONDITION_MULTIPLIER[e.condition],
  }));
}
