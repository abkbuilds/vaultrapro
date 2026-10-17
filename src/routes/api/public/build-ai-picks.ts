import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily AI Advisor batch. POST with `x-refresh-token` = PRICE_REFRESH_TOKEN.
 * 1) snapshots real sealed-product prices, 2) scores priced cards + sealed,
 * 3) stores today's top picks, 4) grades past picks against real later prices.
 */
export const Route = createFileRoute("/api/public/build-ai-picks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PRICE_REFRESH_TOKEN;
        if (!secret || request.headers.get("x-refresh-token") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const adv = await import("@/lib/advisor/advisor.server");
        const { tcggoListProducts } = await import("@/lib/prices/tcggo-browse.server");
        const today = new Date().toISOString().slice(0, 10);

        // 1. Sealed snapshot (real TCGGO Cardmarket lows converted to USD).
        let sealedSnap = 0;
        for (let page = 1; page <= 4; page++) {
          try {
            const res = await tcggoListProducts({ page, sort: "price_highest" });
            const rows = res.data
              .filter((p) => p.priceUsd != null && p.priceUsd > 0)
              .map((p) => ({
                product_id: String(p.id),
                captured_on: today,
                name: p.name,
                episode: p.episode,
                image: p.image,
                price_usd: p.priceUsd as number,
              }));
            if (rows.length) {
              await supabaseAdmin.from("sealed_price_points").upsert(rows);
              sealedSnap += rows.length;
            }
          } catch {
            break;
          }
        }

        // 2. Score cards in chunks.
        const { data: cands } = await supabaseAdmin
          .from("card_price_latest")
          .select("card_id")
          .gte("price", 5)
          .not("change_30d", "is", null)
          .order("price", { ascending: false })
          .limit(400);
        const ids = (cands ?? []).map((c) => c.card_id);
        const cardPicks = [];
        for (let i = 0; i < ids.length; i += 50) {
          cardPicks.push(...(await adv.scoreCards(ids.slice(i, i + 50))));
        }
        const sealedPicks = await adv.scoreSealed();

        const chosen = [
          ...Object.entries(adv.topBuckets(cardPicks)),
          ...Object.entries(adv.topBuckets(sealedPicks)),
        ].flatMap(([bucket, list]) => list.map((p) => ({ bucket, p })));
        await adv.writeExplanations(chosen.map((c) => c.p));

        if (chosen.length) {
          await supabaseAdmin.from("ai_picks").upsert(
            chosen.map(({ bucket, p }) => ({
              picked_on: today,
              kind: p.kind,
              item_id: p.itemId,
              name: p.name,
              set_name: p.set,
              image: p.image,
              bucket,
              price_at_pick: p.price,
              ai_score: p.aiScore,
              recommendation: p.recommendation,
              confidence: p.confidence,
              risk_level: p.riskLevel,
              expected_return_min: p.expectedReturnMin,
              expected_return_max: p.expectedReturnMax,
              signals: { ...p.signals, thinLiquidity: p.thinLiquidity },
              thesis: p.thesis,
              short_term_outlook: p.shortTermOutlook,
              long_term_outlook: p.longTermOutlook,
              safety_explanation: p.safetyExplanation,
            })),
            { onConflict: "picked_on,kind,item_id" },
          );
        }

        // 4. Grade past picks at 30/60/90 days with real current prices.
        let graded = 0;
        for (const h of [30, 60, 90]) {
          const day = new Date(Date.now() - h * 86_400_000).toISOString().slice(0, 10);
          const { data: past } = await supabaseAdmin
            .from("ai_picks")
            .select("id,kind,item_id,bucket,price_at_pick")
            .eq("picked_on", day);
          for (const pk of past ?? []) {
            let now: number | null = null;
            if (pk.kind === "card") {
              const { data } = await supabaseAdmin.from("card_price_latest").select("price").eq("card_id", pk.item_id).maybeSingle();
              now = data ? Number(data.price) : null;
            } else {
              const { data } = await supabaseAdmin.from("sealed_price_points").select("price_usd").eq("product_id", pk.item_id).order("captured_on", { ascending: false }).limit(1).maybeSingle();
              now = data ? Number(data.price_usd) : null;
            }
            if (now == null) continue;
            const ret = ((now - Number(pk.price_at_pick)) / Number(pk.price_at_pick)) * 100;
            const win = pk.bucket === "buy" ? ret > 0 : pk.bucket === "sell" ? ret < 0 : Math.abs(ret) <= 10;
            await supabaseAdmin.from("ai_pick_outcomes").upsert({ pick_id: pk.id, horizon_days: h, price_after: now, return_pct: ret, win });
            graded++;
          }
        }

        return Response.json({ ok: true, sealedSnap, scored: cardPicks.length + sealedPicks.length, stored: chosen.length, graded });
      },
    },
  },
});
