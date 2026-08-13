import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, supabaseAnon } from "../supabase";

const COLUMN = { "24h": "change_24h", "7d": "change_7d", "30d": "change_30d" } as const;

export default defineTool({
  name: "top_movers",
  title: "Top market movers",
  description:
    "Biggest recorded price gainers or losers across the Pokémon TCG catalogue over the last day, week or month, for English or Japanese cards.",
  inputSchema: {
    window: z.enum(["24h", "7d", "30d"]).describe("Movement window. Defaults to 7d.").optional(),
    direction: z.enum(["gainers", "losers"]).describe("Defaults to gainers.").optional(),
    language: z.enum(["EN", "JP"]).describe("Restrict to English or Japanese printings.").optional(),
    limit: z.number().int().describe("Max cards to return (1-25, default 10).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ window, direction, language, limit }) => {
    const col = COLUMN[window ?? "7d"];
    const take = Math.min(Math.max(limit ?? 10, 1), 25);
    const ascending = direction === "losers";

    let q = supabaseAnon()
      .from("card_price_latest")
      .select(
        `card_id,source,price,currency,${col},tcg_cards!inner(name,english_name,language,set_name,english_set_name,number,rarity,image_small)`,
      )
      .not(col, "is", null)
      .order(col, { ascending })
      .limit(take);
    if (language) q = q.eq("tcg_cards.language", language);

    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    return jsonResult({ window: window ?? "7d", direction: direction ?? "gainers", movers: data ?? [] });
  },
});
