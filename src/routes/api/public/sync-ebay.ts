import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  language: z.enum(["EN", "JP"]).default("EN"),
  limit: z.number().int().min(1).max(200).default(40),
  strategy: z.enum(["unpriced", "missing-ebay", "refresh"]).default("unpriced"),
});


/**
 * Backfills real eBay readings (trimmed median of live raw singles listings)
 * onto the catalogue. Resumable: call repeatedly with the returned
 * `nextOffset` until `done` is true.
 */
export const Route = createFileRoute("/api/public/sync-ebay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PRICE_REFRESH_TOKEN;
        if (secret && request.headers.get("x-refresh-token") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        let parsed;
        try {
          const raw = await request.text();
          parsed = bodySchema.parse(raw ? JSON.parse(raw) : {});
        } catch (e) {
          return Response.json({ error: `Invalid body: ${String(e)}` }, { status: 400 });
        }
        const { runEbaySync } = await import("@/lib/prices/ebay-sync.server");
        try {
          return Response.json(await runEbaySync(parsed));
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
