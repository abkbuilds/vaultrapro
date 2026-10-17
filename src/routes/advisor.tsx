import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, Search, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader, money } from "@/components/tcg/CardBits";
import { analyzeItem, fetchAdvisorPicks, fetchTrackRecord } from "@/lib/advisor/advisor.functions";
import { searchCards } from "@/lib/catalog/queries";
import { useCollection } from "@/lib/tcg/collection";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/advisor")({
  head: () => ({
    meta: [
      { title: "AI Investment Advisor — Vaultra" },
      { name: "description", content: "Daily buy, sell and hold signals for Pokémon cards and sealed products, scored only from real recorded prices." },
      { property: "og:title", content: "AI Investment Advisor — Vaultra" },
      { property: "og:description", content: "Data-driven Pokémon card picks with clear risk and safety explanations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Advisor,
});

type Signal = { score: number | null; detail: string };
interface PickView {
  key: string;
  itemId: string;
  kind: string;
  bucket: string;
  name: string;
  set: string | null;
  image: string | null;
  price: number;
  aiScore: number;
  recommendation: string;
  confidence: number;
  riskLevel: string;
  min: number | null;
  max: number | null;
  thesis: string | null;
  short: string | null;
  long: string | null;
  safety: string | null;
  signals: Record<string, Signal>;
  thin: boolean;
}

const SIGNAL_LABELS: Record<string, string> = {
  priceTrend: "Price trend",
  volume: "Volume",
  sentiment: "Sentiment",
  technicals: "Technicals",
  gradingRoi: "Grading ROI",
  population: "Population",
  liquidity: "Liquidity",
};

const REC_LABEL: Record<string, string> = {
  "Strong Buy": "Great time to buy",
  Buy: "Good time to buy",
  Hold: "Keep it",
  Sell: "Think about selling",
  "Strong Sell": "Good time to sell",
};
const RISK_LABEL: Record<string, string> = {
  Safe: "Steady price",
  Caution: "Some ups and downs",
  "High Risk": "Price jumps a lot",
};
const sureLabel = (c: number) => (c >= 75 ? "High" : c >= 55 ? "Medium" : "Low");

function recTone(r: string) {
  if (r.includes("Buy")) return "bg-success/15 text-success ring-success/30";
  if (r.includes("Sell")) return "bg-destructive/15 text-destructive ring-destructive/30";
  return "bg-warning/15 text-warning ring-warning/30";
}
function riskTone(r: string) {
  if (r === "Safe") return "text-success";
  if (r === "High Risk") return "text-destructive";
  return "text-warning";
}
const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
const REASON_ORDER = ["priceTrend", "technicals", "volume", "liquidity", "gradingRoi"];

function Advisor() {
  const [kind, setKind] = useState<"card" | "sealed">("card");
  const getPicks = useServerFn(fetchAdvisorPicks);
  const picksQ = useQuery({ queryKey: ["advisor-picks"], queryFn: () => getPicks(), staleTime: 10 * 60_000 });

  const picks: PickView[] = useMemo(
    () =>
      (picksQ.data?.picks ?? []).map((p) => {
        const sig = (p.signals ?? {}) as Record<string, unknown>;
        return {
          key: p.id,
          itemId: p.item_id,
          kind: p.kind,
          bucket: p.bucket,
          name: p.name,
          set: p.set_name,
          image: p.image,
          price: Number(p.price_at_pick),
          aiScore: p.ai_score,
          recommendation: p.recommendation,
          confidence: p.confidence,
          riskLevel: p.risk_level,
          min: p.expected_return_min == null ? null : Number(p.expected_return_min),
          max: p.expected_return_max == null ? null : Number(p.expected_return_max),
          thesis: p.thesis,
          short: p.short_term_outlook,
          long: p.long_term_outlook,
          safety: p.safety_explanation,
          signals: Object.fromEntries(Object.entries(sig).filter(([k]) => k in SIGNAL_LABELS)) as Record<string, Signal>,
          thin: Boolean(sig["thinLiquidity"]),
        };
      }),
    [picksQ.data],
  );

  return (
    <main className="pb-6">
      <PageHeader title="AI Advisor" subtitle="Daily signals from real recorded prices" />
      <div className="mx-4 flex gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
        <AlertTriangle className="size-4 shrink-0" />
        <p>
          This is not financial advice. Pokémon card markets are volatile and sentiment-driven. Always do your own
          research.
        </p>
      </div>
      <div className="mx-4 mt-3 rounded-2xl bg-surface p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">How to read this</p>
        <p className="mt-1">
          Each card gets a score out of 100 based on its real recent prices. Higher means a better time to buy, lower
          means a better time to sell.
        </p>
      </div>


      <SearchAdvisor />
      <CollectionInsights picks={picks} />

      <section className="mt-6 px-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Today's picks</h2>
          {picksQ.data?.refreshedAt && (
            <span className="text-[11px] text-muted-foreground">
              Refreshed {new Date(picksQ.data.refreshedAt).toLocaleString()}
            </span>
          )}
        </div>
        <div className="mt-3 inline-flex rounded-xl bg-surface p-1 text-sm">
          {(["card", "sealed"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn("rounded-lg px-4 py-1.5 font-medium", kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              {k === "card" ? "Cards" : "Sealed"}
            </button>
          ))}
        </div>

        {picksQ.isLoading ? (
          <div className="grid h-40 place-items-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : picksQ.isError ? (
          <p className="py-8 text-center text-sm text-destructive">Couldn't load picks. Please try again shortly.</p>
        ) : (
          (["buy", "sell", "hold"] as const).map((b) => {
            const list = picks.filter((p) => p.kind === kind && p.bucket === b);
            return (
              <div key={b} className="mt-5">
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {b === "buy" ? "Worth buying" : b === "sell" ? "Worth selling or skipping" : "Worth keeping"}
                </h3>
                {list.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {list.map((p) => (
                      <PickCard key={p.key} p={p} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl bg-surface/60 p-4 text-sm text-muted-foreground">
                    {kind === "sealed"
                      ? "Not enough recorded sealed-product price history yet. This fills in as daily readings build."
                      : "No picks in this group today — not enough real price history qualifies."}
                  </p>
                )}
              </div>
            );
          })
        )}
      </section>

      <TrackRecord />
    </main>
  );
}

function PickCard({ p, full }: { p: PickView; full?: boolean }) {
  const body = (
    <article className="glass-panel rounded-2xl p-4">
      <div className="flex gap-3">
        {p.image ? (
          <img src={p.image} alt="" loading="lazy" className="h-20 w-14 rounded-lg object-cover" />
        ) : (
          <span className="h-20 w-14 rounded-lg bg-surface-2" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{p.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{p.set}</p>
          <p className="mt-1 text-sm font-bold">{money(p.price)}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
            <span className={cn("rounded-full px-2 py-0.5 ring-1", recTone(p.recommendation))}>
              {REC_LABEL[p.recommendation] ?? p.recommendation}
            </span>
            <span className={cn("rounded-full bg-surface px-2 py-0.5", riskTone(p.riskLevel))}>
              {RISK_LABEL[p.riskLevel] ?? p.riskLevel}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold tabular-nums">{p.aiScore}</p>
          <p className="text-[10px] text-muted-foreground">out of 100</p>
          <p className="mt-1 text-[11px] text-muted-foreground">How sure: {sureLabel(p.confidence)}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed">{p.thesis}</p>
      {(() => {
        const reasons = REASON_ORDER.map((k) => p.signals[k]).filter((s) => s && s.score != null);
        const missing = REASON_ORDER.some((k) => !p.signals[k] || p.signals[k].score == null);
        return (
          <>
            {reasons.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                {reasons.slice(0, full ? 5 : 3).map((s, i) => (
                  <li key={i}>{s.detail}</li>
                ))}
              </ul>
            )}
            {full && missing && <p className="mt-1 text-[11px] text-muted-foreground">Some info isn't available yet.</p>}
          </>
        );
      })()}
      {p.safety && (
        <p className="mt-2 flex gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0" /> {p.safety}
        </p>
      )}
      {p.min != null && p.max != null && (
        <p className="mt-2 text-xs">
          Over the next month, the price could move between {pct(p.min)} and {pct(p.max)}.
        </p>
      )}
      {p.thin && (
        <p className="mt-2 text-xs text-warning">
          Not many people buy or sell this, so the price can change quickly.
        </p>
      )}
      {full && (p.short || p.long) && (
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <p className="rounded-xl bg-surface p-2"><b>Next 1–2 weeks:</b> {p.short}</p>
          <p className="rounded-xl bg-surface p-2"><b>Next 1–3 months:</b> {p.long}</p>
        </div>
      )}
    </article>
  );
  if (p.kind !== "card" || full) return body;
  return (
    <Link to="/card/$cardId" params={{ cardId: p.itemId }}>
      {body}
    </Link>
  );
}

function SearchAdvisor() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const results = useQuery({
    queryKey: ["advisor-search", q],
    queryFn: () => searchCards({ query: q, pageSize: 6 }),
    enabled: q.trim().length >= 2 && !selected,
  });
  const analyze = useServerFn(analyzeItem);
  const analysis = useQuery({
    queryKey: ["advisor-analyze", selected],
    queryFn: () => analyze({ data: { cardId: selected! } }),
    enabled: !!selected,
    staleTime: 30 * 60_000,
  });
  const rows = (results.data as { cards?: Array<{ id: string; name: string; setName: string; number: string }> } | undefined)?.cards ?? [];

  return (
    <section className="mt-5 px-4">
      <h2 className="font-display text-lg font-semibold">Analyse any card</h2>
      <div className="mt-2 flex items-center gap-2 rounded-xl bg-surface px-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSelected(null);
          }}
          placeholder="e.g. Umbreon VMAX, Charizard…"
          className="h-11 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {!selected && results.isFetching && <Loader2 className="mt-3 size-4 animate-spin text-muted-foreground" />}
      {!selected && rows.length > 0 && (
        <ul className="mt-2 divide-y divide-border rounded-xl bg-surface/60">
          {rows.map((c) => (
            <li key={c.id}>
              <button onClick={() => setSelected(c.id)} className="w-full px-3 py-2 text-left text-sm">
                {c.name} <span className="text-xs text-muted-foreground">· {c.setName} · {c.number}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <div className="mt-3">
          {analysis.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4 animate-pulse" /> Analysing real price history…
            </div>
          ) : analysis.isError ? (
            <p className="text-sm text-destructive">Analysis failed. Try again.</p>
          ) : !analysis.data ? (
            <p className="text-sm text-muted-foreground">No recorded price for this card yet, so it can't be scored.</p>
          ) : (
            <PickCard
              full
              p={{
                key: analysis.data.id,
                itemId: analysis.data.itemId,
                kind: "card",
                bucket: "",
                name: analysis.data.name,
                set: analysis.data.set,
                image: analysis.data.image,
                price: analysis.data.price,
                aiScore: analysis.data.aiScore,
                recommendation: analysis.data.recommendation,
                confidence: analysis.data.confidence,
                riskLevel: analysis.data.riskLevel,
                min: analysis.data.expectedReturnMin,
                max: analysis.data.expectedReturnMax,
                thesis: analysis.data.thesis,
                short: analysis.data.shortTermOutlook,
                long: analysis.data.longTermOutlook,
                safety: analysis.data.safetyExplanation,
                signals: analysis.data.signals,
                thin: analysis.data.thinLiquidity,
              }}
            />
          )}
        </div>
      )}
    </section>
  );
}

function CollectionInsights({ picks }: { picks: PickView[] }) {
  const { entries } = useCollection();
  const ids = new Set(entries.map((e) => e.cardId));
  const mine = picks.filter((p) => p.kind === "card" && ids.has(p.itemId));
  return (
    <section className="mt-5 px-4">
      <div className="rounded-2xl bg-surface p-4">
        <h2 className="font-display text-base font-semibold">Your collection insights</h2>
        {!entries.length ? (
          <p className="mt-2 text-sm text-muted-foreground">Add cards to your collection to get personal notes here.</p>
        ) : !mine.length ? (
          <p className="mt-2 text-sm text-muted-foreground">None of your cards are in today's ranked picks.</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {mine.map((p) => (
              <li key={p.key}>
                {p.bucket === "sell"
                  ? `Consider selling ${p.name} — it's ranked in today's top sells.`
                  : p.bucket === "buy"
                    ? `${p.name} is ranked a top buy today.`
                    : `Your ${p.name} is a Hold according to today's model.`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function TrackRecord() {
  const get = useServerFn(fetchTrackRecord);
  const q = useQuery({ queryKey: ["advisor-track"], queryFn: () => get() });
  return (
    <section className="mt-6 px-4">
      <div className="rounded-2xl bg-surface p-4">
        <h2 className="font-display text-base font-semibold">Track record</h2>
        {q.isLoading ? (
          <Loader2 className="mt-3 size-4 animate-spin text-muted-foreground" />
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="text-left">Window</th><th>Picks graded</th><th>Win rate</th><th>Avg return</th></tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((r) => (
                <tr key={r.horizon} className="text-center">
                  <td className="py-1 text-left">{r.horizon} days</td>
                  <td>{r.count}</td>
                  <td>{r.winRate == null ? "no data yet" : `${r.winRate.toFixed(0)}%`}</td>
                  <td>{r.avgReturn == null ? "—" : pct(r.avgReturn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Measured against real later prices. Past performance is not a guarantee of future results.
        </p>
      </div>
    </section>
  );
}
