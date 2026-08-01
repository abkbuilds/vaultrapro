import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  limit: z.number().int().min(1).max(30).default(6),
  offset: z.number().int().min(0).default(0),
});

/** Backfills missing Japanese card artwork. Call until `remainingSets` is 0. */
export const Route = createFileRoute("/api/public/sync-jp-images")({
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
        const { runJpImageSync } = await import("@/lib/catalog/jp-images.server");
        try {
          return Response.json(await runJpImageSync(parsed));
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
