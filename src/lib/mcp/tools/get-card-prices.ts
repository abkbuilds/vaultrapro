import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, supabaseAnon } from "../supabase";

export default defineTool({
  name: "get_card_prices",
  title: "Get card prices and history",
  description:
    "Real recorded prices for one card: the latest quote per source (TCGplayer, Cardmarket, eBay) with 24h/7d/30d movement, plus dated price history and recent sales. Only source-backed data is returned; missing readings mean no data.",
  inputSchema: {
    card_id: z.string().trim().min(1).describe("Card id returned by search_cards."),
    history_days: z
      .number()
      .int()
      .describe("How far back to include price history, in days (1-1825, default 90).")
      .optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ card_id, history_days }) => {
    const days = Math.min(Math.max(history_days ?? 90, 1), 1825);
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const supabase = supabaseAnon();

    const [latest, history, sales] = await Promise.all([
      supabase
        .from("card_price_latest")
        .select("source,price,currency,change_24h,change_7d,change_30d,updated_at")
        .eq("card_id", card_id),
      supabase
        .from("card_price_points")
        .select("source,condition,price,currency,captured_on")
        .eq("card_id", card_id)
        .gte("captured_on", since)
        .order("captured_on", { ascending: true })
        .limit(600),
      supabase
        .from("card_sales")
        .select("source,sold_at,price,currency,price_usd,condition,title,url")
        .eq("card_id", card_id)
        .order("sold_at", { ascending: false })
        .limit(20),
    ]);

    const failure = latest.error ?? history.error ?? sales.error;
    if (failure) throw new ToolError(failure.message);

    return jsonResult({
      card_id,
      latest: latest.data ?? [],
      history: history.data ?? [],
      recent_sales: sales.data ?? [],
      note: "Prices come only from recorded source readings; an empty list means no data.",
    });
  },
});
