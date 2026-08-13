import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, supabaseAnon } from "../supabase";

export default defineTool({
  name: "get_card",
  title: "Get card details",
  description:
    "Fetch one Pokémon card by its catalogue id, including set, rarity, artist, artwork and latest market price.",
  inputSchema: { card_id: z.string().trim().min(1).describe("Card id returned by search_cards.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ card_id }) => {
    const { data, error } = await supabaseAnon()
      .from("tcg_cards")
      .select(
        "id,language,name,english_name,native_name,set_id,set_name,english_set_name,set_code,number,rarity,supertype,subtypes,types,hp,artist,image_small,image_large,market_price,is_promo,release_date",
      )
      .eq("id", card_id)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError(`No card found with id "${card_id}".`);
    return jsonResult(data);
  },
});
