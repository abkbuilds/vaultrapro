import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  page: z.number().int().min(1).default(1),
  pages: z.number().int().min(1).max(20).default(4),
});

/**
 * Backfills real TCGplayer + Cardmarket readings (and their dated averages)
 * from the Pokémon TCG API. Call repeatedly with the returned `nextPage`
 * until `done` is true.
 */
export const Route = createFileRoute("/api/public/sync-ptcg")({
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
        const { runPtcgSync } = await import("@/lib/prices/ptcg-sync.server");
        try {
          return Response.json(await runPtcgSync(parsed));
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
