import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const fetchAdvisorPicks = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data: latest } = await supabase
    .from("ai_picks")
    .select("picked_on,created_at")
    .order("picked_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return { pickedOn: null, refreshedAt: null, picks: [] };
  const { data, error } = await supabase
    .from("ai_picks")
    .select("*")
    .eq("picked_on", latest.picked_on)
    .order("ai_score", { ascending: false });
  if (error) throw new Error("Could not load today's picks");
  return { pickedOn: latest.picked_on, refreshedAt: latest.created_at, picks: data ?? [] };
});

export const analyzeItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ cardId: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const adv = await import("./advisor.server");
    const [pick] = await adv.scoreCards([data.cardId]);
    if (!pick) return null;
    await adv.writeExplanations([pick]);
    return pick;
  });

export const fetchTrackRecord = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.from("ai_pick_outcomes").select("horizon_days,return_pct,win").limit(10000);
  return [30, 60, 90].map((h) => {
    const rows = (data ?? []).filter((r) => r.horizon_days === h);
    return {
      horizon: h,
      count: rows.length,
      winRate: rows.length ? (rows.filter((r) => r.win).length / rows.length) * 100 : null,
      avgReturn: rows.length ? rows.reduce((s, r) => s + Number(r.return_pct), 0) / rows.length : null,
    };
  });
});
