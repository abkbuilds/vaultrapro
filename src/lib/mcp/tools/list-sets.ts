import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, supabaseAnon } from "../supabase";

export default defineTool({
  name: "list_sets",
  title: "List Pokémon sets",
  description:
    "List English and Japanese Pokémon TCG sets in reverse release order, with set ids usable as the set_id filter in search_cards.",
  inputSchema: {
    language: z.enum(["EN", "JP"]).describe("Restrict to English or Japanese sets.").optional(),
    query: z.string().trim().describe("Filter by set name, e.g. 'Surging Sparks'.").optional(),
    limit: z.number().int().describe("Max sets to return (1-100, default 50).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ language, query, limit }) => {
    const take = Math.min(Math.max(limit ?? 50, 1), 100);
    let q = supabaseAnon()
      .from("tcg_sets")
      .select("id,language,name,english_name,code,series,printed_total,total,release_date,logo_url")
      .order("release_date", { ascending: false, nullsFirst: false })
      .limit(take);
    if (language) q = q.eq("language", language);
    if (query) q = q.or(`name.ilike.%${query}%,english_name.ilike.%${query}%`);

    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    return jsonResult({ sets: data ?? [] });
  },
});
