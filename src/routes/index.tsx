import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpRight, Bell, Handshake, ScanLine, Sparkles } from "lucide-react";
import { PageHeader, PriceDelta, CardRow, money } from "@/components/tcg/CardBits";
import { TrendAreaChart } from "@/components/tcg/Charts";
import { RangeToggle } from "@/components/tcg/RangeToggle";
import { useCollection, valueEntries, portfolioSeries } from "@/lib/tcg/collection";
import { RANGE_DAYS, type TimeRange } from "@/lib/tcg/types";
import { getAllIndices } from "@/lib/tcg/trends";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Portfolio — Vaultra TCG Tracker" },
      {
        name: "description",
        content:
          "Your live TCG portfolio value, top movers and recent scans in one mobile dashboard.",
      },
      { property: "og:title", content: "Portfolio — Vaultra TCG Tracker" },
      {
        property: "og:description",
        content: "Track your card collection's value across TCGplayer, eBay and snkrdunk.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { entries } = useCollection();
  const [range, setRange] = useState<TimeRange>("3M");
  const valued = useMemo(() => valueEntries(entries), [entries]);

  const total = valued.reduce((s, e) => s + e.value, 0);
  const cost = valued.reduce((s, e) => s + e.cost, 0);
  const gain = total - cost;
  const gainPct = cost ? (gain / cost) * 100 : 0;
  const series = useMemo(
    () => portfolioSeries(total, RANGE_DAYS[range]),
    [total, range],
  );

  const movers = [...valued].sort((a, b) => b.card.change7d - a.card.change7d);
  const indices = getAllIndices("1W");

  return (
    <main>
      <PageHeader
        title="Portfolio"
        subtitle="Updated a few seconds ago"
        action={
          <Link
            to="/profile"
            className="grid size-10 place-items-center rounded-xl bg-surface text-muted-foreground"
            aria-label="Notifications and settings"
          >
            <Bell className="size-5" />
          </Link>
        }
      />

      <section className="px-4">
        <div className="glass-panel rounded-3xl p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Total value
          </p>
          <div className="mt-1 flex items-end gap-3">
            <p className="font-display text-4xl font-bold tabular-nums">{money(total)}</p>
            <PriceDelta value={gainPct} className="mb-1.5" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {gain >= 0 ? "+" : "−"}
            {money(Math.abs(gain))} all-time · {valued.length} lots ·{" "}
            {valued.reduce((s, e) => s + e.quantity, 0)} cards
          </p>
          <div className="mt-3">
            <TrendAreaChart data={series} />
          </div>
          <div className="mt-3">
            <RangeToggle value={range} onChange={setRange} />
          </div>
        </div>
      </section>

      <section className="mt-5 px-4">
        <Link
          to="/scan"
          className="flex items-center gap-3 rounded-2xl bg-linear-to-r from-primary/25 to-accent/20 p-4 ring-1 ring-primary/30"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ScanLine className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold">Scan cards with AI</span>
            <span className="block text-xs text-muted-foreground">
              Bulk mode identifies EN + JP cards instantly
            </span>
          </span>
          <ArrowUpRight className="size-5 text-muted-foreground" />
        </Link>
        <Link
          to="/trades"
          className="mt-2 flex items-center gap-3 rounded-2xl bg-surface p-4"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-surface-2 text-accent">
            <Handshake className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold">Log a sale or trade</span>
            <span className="block text-xs text-muted-foreground">
              Card shows, deals and flips — with realised P/L
            </span>
          </span>
          <ArrowUpRight className="size-5 text-muted-foreground" />
        </Link>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between px-4 pb-2">
          <h2 className="font-display text-lg font-semibold">My top movers</h2>
          <Link to="/trends" className="text-xs font-semibold text-primary">
            Market movers
          </Link>
        </div>
        <div className="space-y-2 px-4">
          {movers.slice(0, 4).map((e) => (
            <CardRow
              key={e.id}
              card={e.card}
              sub={`${e.quantity}× ${e.condition}`}
              right={
                <div className="space-y-1">
                  <p className="text-sm font-bold tabular-nums">{money(e.value)}</p>
                  <PriceDelta value={e.card.change7d} />
                </div>
              }
            />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between px-4 pb-2">
          <h2 className="font-display text-lg font-semibold">Market pulse</h2>
          <Link to="/trends" className="text-xs font-semibold text-primary">
            Trends
          </Link>
        </div>
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
          {indices.map((i) => (
            <div key={i.game} className="w-36 shrink-0 rounded-2xl bg-surface p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 text-accent" />
                {i.short}
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums">
                {i.index.toLocaleString()}
              </p>
              <PriceDelta value={i.change} className="mt-1" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
