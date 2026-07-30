import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type TradeKind = "sale" | "purchase" | "trade";

export const TRADE_VENUES = [
  "Card show",
  "Local meetup",
  "eBay",
  "TCGplayer",
  "Instagram / Discord",
  "Friend",
  "Other",
] as const;

export type TradeVenue = (typeof TRADE_VENUES)[number];

export interface TradeRecord {
  id: string;
  kind: TradeKind;
  cardId: string;
  cardName: string;
  setLabel: string;
  quantity: number;
  /** Cash per unit for a sale/purchase, or cash difference for a trade. */
  unitPrice: number;
  fees: number;
  venue: TradeVenue;
  counterparty: string;
  /** What you received (trades only). */
  receivedFor: string;
  date: string;
  notes: string;
}

const KEY = "vaultcard.trades.v1";

interface Ctx {
  trades: TradeRecord[];
  addTrade: (t: Omit<TradeRecord, "id">) => void;
  removeTrade: (id: string) => void;
}

const TradeContext = createContext<Ctx | null>(null);

export function TradeProvider({ children }: { children: ReactNode }) {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setTrades(JSON.parse(raw) as TradeRecord[]);
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(KEY, JSON.stringify(trades));
  }, [trades, hydrated]);

  const addTrade = useCallback((t: Omit<TradeRecord, "id">) => {
    setTrades((prev) => [{ ...t, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }, ...prev]);
  }, []);

  const removeTrade = useCallback((id: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ trades, addTrade, removeTrade }), [trades, addTrade, removeTrade]);
  return <TradeContext.Provider value={value}>{children}</TradeContext.Provider>;
}

export function useTrades() {
  const ctx = useContext(TradeContext);
  if (!ctx) throw new Error("useTrades must be used inside TradeProvider");
  return ctx;
}

export function tradeTotals(trades: TradeRecord[]) {
  let sold = 0;
  let spent = 0;
  let fees = 0;
  let tradeCash = 0;
  for (const t of trades) {
    const gross = t.unitPrice * t.quantity;
    fees += t.fees;
    if (t.kind === "sale") sold += gross;
    else if (t.kind === "purchase") spent += gross;
    else tradeCash += gross;
  }
  return {
    sold,
    spent,
    fees,
    tradeCash,
    realized: sold + tradeCash - spent - fees,
    count: trades.length,
  };
}
