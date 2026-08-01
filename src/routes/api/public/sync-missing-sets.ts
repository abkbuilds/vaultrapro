import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  mode: z.enum(["cards", "dates"]).default("cards"),
  language: z.enum(["EN", "JP"]).default("EN"),
  limit: z.number().int().min(1).max(60).optional(),
});

/**
 * Backfills sets that hold no cards (from the keyless TCGplayer mirror) and
 * fills in missing release dates so sets sort chronologically.
 * Call repeatedly until `remaining` is 0.
 */
export const Route = createFileRoute("/api/public/sync-missing-sets")({
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

        const { runMissingCardBackfill, runReleaseDateBackfill } = await import(
          "@/lib/catalog/missing-sets.server"
        );

        try {
          const result =
            parsed.mode === "dates"
              ? await runReleaseDateBackfill(parsed)
              : await runMissingCardBackfill(parsed);
          return Response.json(result);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
