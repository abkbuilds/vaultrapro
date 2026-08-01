import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({ limit: z.number().int().min(1).max(1000).default(1000) });

/** Translates remaining Japanese card names to English via PokéAPI. */
export const Route = createFileRoute("/api/public/sync-jp-names")({
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
        const { runJpNameSync } = await import("@/lib/catalog/jp-names.server");
        try {
          return Response.json(await runJpNameSync(parsed));
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
