/**
 * Per-card trend windows (server-only).
 *
 * Backed entirely by dated readings already captured in `card_price_points`
 * (via the `card_trend` SQL function). A window only appears when a real
 * earlier reading exists — nothing is extrapolated.
 */
import { supabase } from "@/integrations/supabase/client";

export interface TrendWindow {
  /** 7, 30, 90, 365 or 1825. */
  days: number;
  label: string;
  pct: number;
  fromPrice: number;
  toPrice: number;
  fromDate: string;
}

export const WINDOW_LABEL: Record<number, string> = {
  7: "1W",
  30: "1M",
  90: "3M",
  365: "1Y",
  1825: "5Y",
};

export async function getCardTrend(cardId: string): Promise<TrendWindow[]> {
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>
  )("card_trend", { _card_id: cardId });
  if (error || !data) return [];
  const rows = data as {
    window_days: number;
    pct: number | string;
    from_price: number | string;
    to_price: number | string;
    from_date: string;
  }[];
  return rows
    .map((r) => ({
      days: Number(r.window_days),
      label: WINDOW_LABEL[Number(r.window_days)] ?? `${r.window_days}d`,
      pct: Number(r.pct),
      fromPrice: Number(r.from_price),
      toPrice: Number(r.to_price),
      fromDate: r.from_date,
    }))
    .filter((r) => Number.isFinite(r.pct))
    .sort((a, b) => a.days - b.days);
}
