import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  limit: z.number().int().min(1).max(20).default(4),
  force: z.boolean().optional(),
});

/**
 * Backfills English names, English set names and TCGplayer market prices onto
 * Japanese cards (and inserts Japanese cards/promos missing upstream).
 * Call repeatedly until `remainingSets` is 0.
 */
export const Route = createFileRoute("/api/public/sync-jp-english")({
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

        const { runJpEnglishSync } = await import("@/lib/catalog/jp-english.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        try {
          const result = await runJpEnglishSync(parsed);
          await supabaseAdmin.from("catalog_sync_runs").insert({
            source: "tcgcsv.com",
            status: result.done ? "complete" : "partial",
            cards_upserted: result.cardsUpdated + result.cardsInserted,
            detail: `${result.setsProcessed.length} sets, ${result.remainingSets} remaining`,
            finished_at: new Date().toISOString(),
          });
          return Response.json(result);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
