import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  language: z.enum(["EN", "JP"]).default("EN"),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
  onlyMissing: z.boolean().default(true),
});

/**
 * Backfills real prices from PokéWallet for cards no keyless feed could price.
 * Call repeatedly with the returned `nextOffset` until `done` is true.
 */
export const Route = createFileRoute("/api/public/sync-pokewallet")({
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
        const { runPokewalletSync } = await import("@/lib/prices/pokewallet-sync.server");
        try {
          return Response.json(await runPokewalletSync(parsed));
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
