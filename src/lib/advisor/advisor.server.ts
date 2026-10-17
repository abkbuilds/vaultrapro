/**
 * AI Advisor data assembly (server-only). Every input is a recorded reading
 * from card_price_latest / card_price_points / card_sales / sealed_price_points.
 * Scores are deterministic (./score); the model only words the explanation.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchCardsByIds } from "@/lib/catalog/queries";
import { bucketOf, factualThesis, scoreItem, type AdvisorInputs, type AdvisorResult } from "./score";

export interface AdvisorPick extends AdvisorResult {
  id: string;
  itemId: string;
  kind: "card" | "sealed";
  name: string;
  set: string | null;
  image: string | null;
  price: number;
  thesis: string;
  shortTermOutlook: string | null;
  longTermOutlook: string | null;
  safetyExplanation: string | null;
  pickedOn?: string;
}

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function stats(series: Array<{ date: string; value: number }>) {
  const s = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const moves: number[] = [];
  for (let i = 1; i < s.length; i++) {
    if (s[i - 1].value > 0) moves.push(((s[i].value - s[i - 1].value) / s[i - 1].value) * 100);
  }
  const volatility =
    moves.length >= 4
      ? Math.sqrt(moves.reduce((a, m) => a + m * m, 0) / moves.length - (moves.reduce((a, m) => a + m, 0) / moves.length) ** 2)
      : null;
  const cutoff = isoDay(new Date(Date.now() - 30 * DAY));
  const last30 = s.filter((p) => p.date >= cutoff);
  const avg30 = last30.length >= 3 ? last30.reduce((a, p) => a + p.value, 0) / last30.length : null;
  const p90 = s.find((p) => p.date >= isoDay(new Date(Date.now() - 95 * DAY)));
  return { volatility, avg30, first90: p90?.value ?? null, readings: s.length };
}

/** Builds real advisor inputs for a set of card ids. */
export async function cardInputs(cardIds: string[]) {
  const since = isoDay(new Date(Date.now() - 90 * DAY));
  const since30 = new Date(Date.now() - 30 * DAY).toISOString();
  const [latest, points, sales] = await Promise.all([
    supabase.from("card_price_latest").select("card_id,price,change_7d,change_30d,source").in("card_id", cardIds),
    supabase
      .from("card_price_points")
      .select("card_id,captured_on,price,source")
      .in("card_id", cardIds)
      .eq("condition", "Near Mint")
      .gte("captured_on", since)
      .limit(20000),
    supabase.from("card_sales").select("card_id").in("card_id", cardIds).gte("sold_at", since30).limit(5000),
  ]);
  const out = new Map<string, AdvisorInputs>();
  for (const l of latest.data ?? []) {
    const pts = (points.data ?? []).filter((p) => p.card_id === l.card_id);
    const own = pts.filter((p) => p.source === l.source).map((p) => ({ date: p.captured_on, value: Number(p.price) }));
    const st = stats(own);
    const price = Number(l.price);
    out.set(l.card_id, {
      price,
      change7d: l.change_7d,
      change30d: l.change_30d,
      change90d: st.first90 ? ((price - st.first90) / st.first90) * 100 : null,
      volatility: st.volatility,
      readings: pts.length,
      sales30d: (sales.data ?? []).filter((s) => s.card_id === l.card_id).length,
      sources: new Set(pts.map((p) => p.source)).size || 1,
      vsAvg30: st.avg30 ? ((price - st.avg30) / st.avg30) * 100 : null,
      gradedMultiple: null,
    });
  }
  return out;
}

export async function scoreCards(cardIds: string[]): Promise<AdvisorPick[]> {
  if (!cardIds.length) return [];
  const [inputs, cards] = await Promise.all([cardInputs(cardIds), fetchCardsByIds(cardIds)]);
  return cards.flatMap((c) => {
    const inp = inputs.get(c.id);
    if (!inp) return [];
    const r = scoreItem(inp);
    return [
      {
        ...r,
        id: c.id,
        itemId: c.id,
        kind: "card" as const,
        name: c.name,
        set: `${c.setName} · ${c.number} · ${c.language}`,
        image: c.image || null,
        price: inp.price,
        thesis: factualThesis(c.name, r),
        shortTermOutlook: null,
        longTermOutlook: null,
        safetyExplanation: null,
      },
    ];
  });
}

export async function scoreSealed(): Promise<AdvisorPick[]> {
  const since = isoDay(new Date(Date.now() - 95 * DAY));
  const { data } = await supabase
    .from("sealed_price_points")
    .select("product_id,captured_on,name,episode,image,price_usd")
    .gte("captured_on", since)
    .limit(20000);
  const byId = new Map<string, NonNullable<typeof data>>();
  for (const r of data ?? []) byId.set(r.product_id, [...(byId.get(r.product_id) ?? []), r]);
  const picks: AdvisorPick[] = [];
  for (const [id, rows] of byId) {
    const s = rows.sort((a, b) => a.captured_on.localeCompare(b.captured_on));
    if (s.length < 2) continue; // need at least two real readings for any trend
    const last = s[s.length - 1];
    const price = Number(last.price_usd);
    const at = (days: number) => {
      const d = isoDay(new Date(Date.now() - days * DAY));
      const p = [...s].reverse().find((r) => r.captured_on <= d);
      return p ? ((price - Number(p.price_usd)) / Number(p.price_usd)) * 100 : null;
    };
    const st = stats(s.map((r) => ({ date: r.captured_on, value: Number(r.price_usd) })));
    const r = scoreItem({
      price,
      change7d: at(7),
      change30d: at(30),
      change90d: at(90),
      volatility: st.volatility,
      readings: s.length,
      sales30d: 0,
      sources: 1,
      vsAvg30: st.avg30 ? ((price - st.avg30) / st.avg30) * 100 : null,
      gradedMultiple: null,
    });
    picks.push({
      ...r,
      id,
      itemId: id,
      kind: "sealed",
      name: last.name,
      set: last.episode,
      image: last.image,
      price,
      thesis: factualThesis(last.name, r),
      shortTermOutlook: null,
      longTermOutlook: null,
      safetyExplanation: null,
    });
  }
  return picks;
}

export function topBuckets(picks: AdvisorPick[], n = 10) {
  const buy = picks.filter((p) => bucketOf(p.recommendation) === "buy").sort((a, b) => b.aiScore - a.aiScore);
  const sell = picks.filter((p) => bucketOf(p.recommendation) === "sell").sort((a, b) => a.aiScore - b.aiScore);
  const hold = picks
    .filter((p) => bucketOf(p.recommendation) === "hold")
    .sort((a, b) => b.confidence - a.confidence || Math.abs(a.aiScore - 50) - Math.abs(b.aiScore - 50));
  return { buy: buy.slice(0, n), sell: sell.slice(0, n), hold: hold.slice(0, n) };
}

/** Model writes wording only, from the real numbers given. Falls back to factual text. */
export async function writeExplanations(picks: AdvisorPick[]): Promise<void> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key || !picks.length) return;
  const facts = picks.map((p) => ({
    id: p.id,
    name: p.name,
    price_usd: p.price,
    score: p.aiScore,
    recommendation: p.recommendation,
    risk: p.riskLevel,
    confidence: p.confidence,
    return_range_30d: p.expectedReturnMin == null ? null : [p.expectedReturnMin, p.expectedReturnMax],
    signals: Object.fromEntries(Object.entries(p.signals).map(([k, v]) => [k, v.detail])),
  }));
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "thesis", "short_term", "long_term", "safety"],
          properties: {
            id: { type: "string" },
            thesis: { type: "string" },
            short_term: { type: "string" },
            long_term: { type: "string" },
            safety: { type: "string" },
          },
        },
      },
    },
  };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        Authorization: `Bearer ${key}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        store: false,
        stream: true,
        reasoning: { effort: "low" },
        instructions:
          "You explain Pokémon card market signals in plain English. Use ONLY the numbers provided; never invent prices, sales, sentiment or population data. If a signal says no data, say so. For each item write: thesis (2-4 sentences explaining why the recommendation), short_term (1-2 weeks outlook, 1 sentence), long_term (1-3 months, 1 sentence), safety (1-2 sentences: why this may be safe or risky right now). No financial-advice guarantees.",
        input: JSON.stringify(facts),
        text: { format: { type: "json_schema", name: "explanations", strict: true, schema } },
      }),
    });
    if (!res.ok || !res.body) {
      console.error("advisor explanations failed", res.status);
      return;
    }
    // Consume SSE and accumulate output text.
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const frames = buf.split("\n\n");
      buf = frames.pop() ?? "";
      for (const f of frames) {
        const line = f.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.type === "response.output_text.delta") text += ev.delta;
        } catch {
          /* ignore partial */
        }
      }
    }
    const parsed = JSON.parse(text) as { items: Array<{ id: string; thesis: string; short_term: string; long_term: string; safety: string }> };
    const map = new Map(parsed.items.map((i) => [i.id, i]));
    for (const p of picks) {
      const e = map.get(p.id);
      if (!e) continue;
      p.thesis = e.thesis;
      p.shortTermOutlook = e.short_term;
      p.longTermOutlook = e.long_term;
      p.safetyExplanation = e.safety;
    }
  } catch (e) {
    console.error("advisor explanations error", e);
  }
}
