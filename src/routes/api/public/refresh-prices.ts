import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily price snapshot. Point a scheduler at:
 *   POST /api/public/refresh-prices?offset=0&limit=50
 * with the `x-refresh-token` header matching PRICE_REFRESH_TOKEN (when set).
 */
export const Route = createFileRoute("/api/public/refresh-prices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PRICE_REFRESH_TOKEN;
        if (secret && request.headers.get("x-refresh-token") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 25), 100);
        const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

        const { snapshotCard, snapshotTargets } = await import(
          "@/lib/prices/history.server"
        );
        const { ingestSales } = await import("@/lib/prices/sales.server");
        const cards = await snapshotTargets(limit, offset);
        let written = 0;
        let sales = 0;
        for (const card of cards) {
          try {
            written += await snapshotCard(card);
          } catch {
            /* keep going; one bad card should not stop the batch */
          }
          try {
            sales += (await ingestSales(card)).inserted;
          } catch {
            /* sale feeds are best-effort */
          }
        }
        return Response.json({
          ok: true,
          cards: cards.length,
          rows: written,
          sales,
          nextOffset: offset + cards.length,
        });

      },
    },
  },
});
