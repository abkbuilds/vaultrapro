/**
 * Deterministic AI Advisor scoring. Pure functions: every input is a real,
 * recorded figure; missing figures stay null and are excluded from the score.
 */
export type Recommendation = "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
export type RiskLevel = "Safe" | "Caution" | "High Risk";

export interface AdvisorInputs {
  price: number;
  change7d: number | null;
  change30d: number | null;
  change90d: number | null;
  /** Std-dev of daily % moves over recorded history, in percent. */
  volatility: number | null;
  /** Number of recorded price readings in the last 90 days. */
  readings: number;
  /** Real completed sales in the last 30 days. */
  sales30d: number;
  /** Distinct marketplaces with a reading. */
  sources: number;
  /** Price vs 30-day average of readings, in %. */
  vsAvg30: number | null;
  /** PSA 10 graded price / raw price, when known. */
  gradedMultiple: number | null;
}

export interface SignalValue {
  score: number | null; // 0-100, null = no data
  detail: string;
}

export interface AdvisorResult {
  aiScore: number;
  recommendation: Recommendation;
  confidence: number;
  riskLevel: RiskLevel;
  expectedReturnMin: number | null;
  expectedReturnMax: number | null;
  thinLiquidity: boolean;
  signals: Record<
    "priceTrend" | "volume" | "sentiment" | "technicals" | "gradingRoi" | "population" | "liquidity",
    SignalValue
  >;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

export function recommendationFor(score: number): Recommendation {
  if (score >= 75) return "Strong Buy";
  if (score >= 60) return "Buy";
  if (score > 40) return "Hold";
  if (score > 25) return "Sell";
  return "Strong Sell";
}

export function riskFor(volatility: number | null, liquidityScore: number | null): RiskLevel {
  if (volatility == null || liquidityScore == null) return "Caution";
  if (volatility > 12 || liquidityScore < 25) return "High Risk";
  if (volatility > 5 || liquidityScore < 50) return "Caution";
  return "Safe";
}

/** Share of signals with real data, weighted by the depth of price history. */
export function confidenceFor(available: number, total: number, readings: number): number {
  const coverage = available / total;
  const depth = Math.min(readings, 30) / 30;
  return Math.round(clamp(35 + coverage * 40 + depth * 25));
}

export function scoreItem(i: AdvisorInputs): AdvisorResult {
  // Trend: blend of real windows (momentum, longer windows weigh more).
  const trendParts: Array<[number, number]> = [];
  if (i.change7d != null) trendParts.push([i.change7d, 1]);
  if (i.change30d != null) trendParts.push([i.change30d, 2]);
  if (i.change90d != null) trendParts.push([i.change90d, 1.5]);
  const trendBlend = trendParts.length
    ? trendParts.reduce((s, [v, w]) => s + v * w, 0) / trendParts.reduce((s, [, w]) => s + w, 0)
    : null;
  const priceTrend: SignalValue =
    trendBlend == null
      ? { score: null, detail: "No recorded trend yet" }
      : {
          score: clamp(50 + trendBlend * 2),
          detail: [
            i.change7d != null && `7d ${pct(i.change7d)}`,
            i.change30d != null && `30d ${pct(i.change30d)}`,
            i.change90d != null && `90d ${pct(i.change90d)}`,
          ]
            .filter(Boolean)
            .join(" · "),
        };

  // Technicals: mean reversion — far above the 30d average is stretched.
  const technicals: SignalValue =
    i.vsAvg30 == null
      ? { score: null, detail: "Not enough readings for a 30-day average" }
      : { score: clamp(50 - i.vsAvg30 * 1.5), detail: `${pct(i.vsAvg30)} vs 30-day average` };

  const volume: SignalValue =
    i.sales30d > 0
      ? { score: clamp(i.sales30d * 8), detail: `${i.sales30d} recorded sales in 30 days` }
      : { score: null, detail: "No recorded sales in 30 days" };

  const liquidityScore = clamp(i.sources * 20 + Math.min(i.readings, 30) * 1.5 + i.sales30d * 3);
  const liquidity: SignalValue = {
    score: liquidityScore,
    detail: `${i.sources} source${i.sources === 1 ? "" : "s"} · ${i.readings} readings in 90 days`,
  };

  const gradingRoi: SignalValue =
    i.gradedMultiple == null
      ? { score: null, detail: "No graded sales recorded" }
      : {
          score: clamp((i.gradedMultiple - 1) * 15),
          detail: `PSA 10 sells at ${i.gradedMultiple.toFixed(1)}× raw`,
        };

  const signals = {
    priceTrend,
    volume,
    sentiment: { score: null, detail: "No sentiment source connected" },
    technicals,
    gradingRoi,
    population: { score: null, detail: "No population report source connected" },
    liquidity,
  } satisfies AdvisorResult["signals"];

  const weights: Record<keyof typeof signals, number> = {
    priceTrend: 0.4,
    technicals: 0.2,
    volume: 0.1,
    liquidity: 0.15,
    gradingRoi: 0.15,
    sentiment: 0,
    population: 0,
  };
  let sum = 0;
  let wsum = 0;
  let available = 0;
  for (const [k, s] of Object.entries(signals) as Array<[keyof typeof signals, SignalValue]>) {
    if (s.score == null) continue;
    available++;
    sum += s.score * weights[k];
    wsum += weights[k];
  }
  const aiScore = Math.round(wsum ? sum / wsum : 50);

  // Return range: centred on 30d momentum, widened by real volatility.
  let expectedReturnMin: number | null = null;
  let expectedReturnMax: number | null = null;
  if (i.volatility != null && i.change30d != null) {
    const centre = i.change30d * 0.5;
    const spread = i.volatility * Math.sqrt(30) * 0.5;
    expectedReturnMin = Math.round((centre - spread) * 10) / 10;
    expectedReturnMax = Math.round((centre + spread) * 10) / 10;
  }

  return {
    aiScore,
    recommendation: recommendationFor(aiScore),
    confidence: confidenceFor(available, 7, i.readings),
    riskLevel: riskFor(i.volatility, liquidityScore),
    expectedReturnMin,
    expectedReturnMax,
    thinLiquidity: liquidityScore < 35,
    signals,
  };
}

export function bucketOf(r: Recommendation): "buy" | "sell" | "hold" {
  if (r === "Strong Buy" || r === "Buy") return "buy";
  if (r === "Hold") return "hold";
  return "sell";
}

/** Fallback plain-English thesis built only from the real figures. */
export function factualThesis(name: string, r: AdvisorResult): string {
  const parts = [`${name} scores ${r.aiScore}/100 (${r.recommendation}).`];
  parts.push(`Trend: ${r.signals.priceTrend.detail}.`);
  if (r.signals.technicals.score != null) parts.push(`Price is ${r.signals.technicals.detail}.`);
  parts.push(`Risk is ${r.riskLevel.toLowerCase()} based on ${r.signals.liquidity.detail}.`);
  return parts.join(" ");
}
