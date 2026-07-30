import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Flame, Snowflake } from "lucide-react";
import { PageHeader, PriceDelta, CardRow, money } from "@/components/tcg/CardBits";
import { TrendAreaChart } from "@/components/tcg/Charts";
import { RangeToggle } from "@/components/tcg/RangeToggle";
import { getAllIndices, getMarketIndex, getMovers } from "@/lib/tcg/trends";
import { GAMES, type GameId, type TimeRange } from "@/lib/tcg/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trends")({
  head: () => ({
    meta: [
      { title: "TCG Market Trends — Vaultra" },
      {
        name: "description",
        content:
          "Weekly market indices for Pokémon, Magic, One Piece, Lorcana and Yu-Gi-Oh! plus the biggest gainers and losers.",
      },
      { property: "og:title", content: "TCG Market Trends — Vaultra" },
      {
        property: "og:description",
        content: "Track which trading card games are heating up and cooling off.",
      },
    ],
  }),
  component: TrendsPage,
});

function TrendsPage() {
  const [range, setRange] = useState<TimeRange>("1W");
  const [game, setGame] = useState<GameId>("pokemon");

  const indices = useMemo(() => getAllIndices(range), [range]);
  const active = useMemo(() => getMarketIndex(game, range), [game, range]);
  const movers = useMemo(() => getMovers(game, range), [game, range]);

  const hot = indices[0];
  const cold = indices[indices.length - 1];

  return (
    <main>
      <PageHeader title="Market" subtitle="Indices refresh every Monday" />

      <section className="grid grid-cols-2 gap-3 px-4">
        <div className="rounded-2xl bg-success/10 p-3 ring-1 ring-success/25">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-success">
            <Flame className="size-3.5" /> Hot this week
          </p>
          <p className="mt-1 text-sm font-bold">{hot.name}</p>
          <PriceDelta value={hot.change} className="mt-1" />
        </div>
        <div className="rounded-2xl bg-destructive/10 p-3 ring-1 ring-destructive/25">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive">
            <Snowflake className="size-3.5" /> Cooling off
          </p>
          <p className="mt-1 text-sm font-bold">{cold.name}</p>
          <PriceDelta value={cold.change} className="mt-1" />
        </div>
      </section>

      <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto px-4">
        {GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGame(g.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              game === g.id
                ? "bg-primary text-primary-foreground"
                : "bg-surface-2 text-muted-foreground",
            )}
          >
            {g.name}
          </button>
        ))}
      </div>

      <section className="mt-3 px-4">
        <div className="glass-panel rounded-3xl p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{active.name} index</p>
              <p className="font-display text-3xl font-bold tabular-nums">
                {active.index.toLocaleString()}
              </p>
            </div>
            <PriceDelta value={active.change} />
          </div>
          <div className="mt-2">
            <TrendAreaChart data={active.series} prefix="" />
          </div>
          <div className="mt-2">
            <RangeToggle value={range} onChange={setRange} />
          </div>
        </div>
      </section>

      <section className="mt-6 px-4">
        <h2 className="pb-2 font-display text-lg font-semibold">Top gainers</h2>
        <div className="space-y-2">
          {movers.gainers.map((m) => (
            <CardRow
              key={m.card.id}
              card={m.card}
              right={
                <div className="space-y-1">
                  <p className="text-sm font-bold tabular-nums">
                    {money(m.card.marketPrice)}
                  </p>
                  <PriceDelta value={m.change} />
                </div>
              }
            />
          ))}
          {movers.gainers.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No gainers tracked for {active.name} in this window yet.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 px-4">
        <h2 className="pb-2 font-display text-lg font-semibold">Top losers</h2>
        <div className="space-y-2">
          {movers.losers.map((m) => (
            <CardRow
              key={m.card.id}
              card={m.card}
              right={
                <div className="space-y-1">
                  <p className="text-sm font-bold tabular-nums">
                    {money(m.card.marketPrice)}
                  </p>
                  <PriceDelta value={m.change} />
                </div>
              }
            />
          ))}
          {movers.losers.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No losers tracked for {active.name} in this window yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
