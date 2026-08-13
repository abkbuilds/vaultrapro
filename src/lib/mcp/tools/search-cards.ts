import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, supabaseAnon } from "../supabase";

const SELECT =
  "id,language,name,english_name,set_name,english_set_name,set_code,number,rarity,image_small,image_large,market_price,is_promo,release_date";

export default defineTool({
  name: "search_cards",
  title: "Search Pokémon cards",
  description:
    "Search the public English and Japanese Pokémon card catalogue by name, set name or set number. Returns card ids, sets, rarities, artwork and the latest market price.",
  inputSchema: {
    query: z.string().trim().describe("Card name, set name or number, e.g. 'Umbreon sv4a 205'.").optional(),
    language: z.enum(["EN", "JP"]).describe("Restrict to English or Japanese printings.").optional(),
    set_id: z.string().trim().describe("Restrict to one set id, from list_sets.").optional(),
    promo_only: z.boolean().describe("Only promo cards.").optional(),
    limit: z.number().int().describe("Max cards to return (1-50, default 20).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, language, set_id, promo_only, limit }) => {
    const take = Math.min(Math.max(limit ?? 20, 1), 50);
    let q = supabaseAnon()
      .from("tcg_cards")
      .select(SELECT, { count: "exact" })
      .order("release_date", { ascending: false, nullsFirst: false })
      .order("number", { ascending: true })
      .limit(take);

    const term = query?.toLowerCase();
    if (term) {
      for (const word of term.split(/\s+/).filter(Boolean).slice(0, 6)) {
        q = q.ilike("search_text", `%${word}%`);
      }
    }
    if (language) q = q.eq("language", language);
    if (set_id) q = q.eq("set_id", set_id);
    if (promo_only) q = q.eq("is_promo", true);

    const { data, error, count } = await q;
    if (error) throw new ToolError(error.message);
    return jsonResult({ total: count ?? data?.length ?? 0, cards: data ?? [] });
  },
});
