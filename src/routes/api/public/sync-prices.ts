import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  language: z.enum(["EN", "JP"]).default("EN"),
  limit: z.number().int().min(1).max(30).default(6),
  offset: z.number().int().min(0).default(0),
});

/**
 * Backfills real TCGplayer market prices (keyless, via tcgcsv.com) onto every
 * matching English or Japanese card and captures a dated price point.
 * Call repeatedly with an increasing `offset` until `remainingSets` is 0.
 */
export const Route = createFileRoute("/api/public/sync-prices")({
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
        const { runPriceSync } = await import("@/lib/prices/tcgcsv.server");
        try {
          return Response.json(await runPriceSync(parsed));
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
