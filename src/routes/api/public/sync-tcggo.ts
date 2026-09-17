import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  language: z.enum(["EN", "JP"]).default("EN"),
  limit: z.number().int().min(1).max(400).default(60),
  offset: z.number().int().min(0).default(0),
  onlyMissing: z.boolean().default(true),
  fillImages: z.boolean().default(true),
  /** Coverage mode (default): never re-checks a card inside the cooldown. */
  coverage: z.boolean().default(true),
  cooldownDays: z.number().int().min(0).max(120).default(14),
});

/**
 * Backfills real TCGplayer / Cardmarket readings (and missing artwork) from the
 * TCGGO feed. Call repeatedly until `done` is true.
 */
export const Route = createFileRoute("/api/public/sync-tcggo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PRICE_REFRESH_TOKEN"];
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
        const { runTcggoSync } = await import("@/lib/prices/tcggo.server");
        try {
          return Response.json(await runTcggoSync(parsed));
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
