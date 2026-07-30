import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  language: z.enum(["EN", "JP"]).default("EN"),
  limit: z.number().int().min(1).max(40).default(6),
  force: z.boolean().optional(),
});

/**
 * Incremental card catalogue sync.
 * Call repeatedly until `remainingSets` is 0.
 */
export const Route = createFileRoute("/api/public/sync-catalog")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          const raw = await request.text();
          parsed = bodySchema.parse(raw ? JSON.parse(raw) : {});
        } catch (e) {
          return Response.json({ error: `Invalid body: ${String(e)}` }, { status: 400 });
        }

        const { runCatalogSync } = await import("@/lib/catalog/sync.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          const result = await runCatalogSync(parsed);
          await supabaseAdmin.from("catalog_sync_runs").insert({
            source: parsed.language === "EN" ? "pokemontcg.io" : "tcgdex.net",
            status: result.done ? "complete" : "partial",
            sets_upserted: result.setsUpserted,
            cards_upserted: result.cardsUpserted,
            detail: `${result.processedSets.length} sets processed, ${result.remainingSets} remaining`,
            finished_at: new Date().toISOString(),
          });
          return Response.json(result);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          await supabaseAdmin.from("catalog_sync_runs").insert({
            source: parsed.language === "EN" ? "pokemontcg.io" : "tcgdex.net",
            status: "error",
            detail: message,
            finished_at: new Date().toISOString(),
          });
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
