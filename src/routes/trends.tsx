import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Flame, Loader2, Snowflake } from "lucide-react";
import { PageHeader, PriceDelta, money } from "@/components/tcg/CardBits";
import { TcgLogo } from "@/components/tcg/TcgLogo";
import { TrendAreaChart } from "@/components/tcg/Charts";
import { RangeToggle } from "@/components/tcg/RangeToggle";
import { getAllIndices, getMarketIndex } from "@/lib/tcg/trends";
import { fetchMovers } from "@/lib/prices/prices.functions";
import type { MoverRow } from "@/lib/prices/history.server";
import { useCollection } from "@/lib/tcg/collection";
import { GAMES, type GameId, type TimeRange } from "@/lib/tcg/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trends")({
  head: () => ({
    meta: [
      { title: "TCG Market Trends & Top Movers — Vaultra" },
      {
        name: "description",
        content:
          "Market indices for Pokémon, Magic, One Piece, Lorcana and Yu-Gi-Oh! plus daily, weekly and monthly top movers for English and Japanese cards.",
      },
      { property: "og:title", content: "TCG Market Trends & Top Movers — Vaultra" },
      {
        property: "og:description",
        content: "Daily, weekly and monthly gainers and losers across English and Japanese Pokémon.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrendsPage,
});

const WINDOWS = [
  { id: "24h", label: "Today" },
  { id: "7d", label: "This week" },
  { id: "30d", label: "This month" },
] as const;

const ALL_RANGES: TimeRange[] = ["1D", "1W", "1M", "3M", "1Y", "5Y", "ALL"];

function TrendsPage() {
  const [range, setRange] = useState<TimeRange>("1W");
  const [game, setGame] = useState<GameId>("pokemon");
  const [win, setWin] = useState<(typeof WINDOWS)[number]["id"]>("24h");
  const [lang, setLang] = useState<"EN" | "JP">("EN");
  const [scope, setScope] = useState<"market" | "portfolio">("market");
  const { entries } = useCollection();

  const indices = useMemo(() => getAllIndices(range), [range]);
  const active = useMemo(() => getMarketIndex(game, range), [game, range]);
  const hot = indices[0];
  const cold = indices[indices.length - 1];

  const portfolioIds = useMemo(
    () => [...new Set(entries.map((e) => e.cardId))],
    [entries],
  );

  const getMovers = useServerFn(fetchMovers);
  const movers = useQuery({
    queryKey: ["movers", win, lang, scope, scope === "portfolio" ? portfolioIds : null],
    queryFn: () =>
      getMovers({
        data: {
          window: win,
          language: lang,
          limit: 10,
          cardIds: scope === "portfolio" ? portfolioIds : undefined,
        },
      }),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <main>
      <PageHeader title="Market" subtitle="Indices and movers across every tracked TCG" />

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

      <section className="mt-5 px-4">
        <h2 className="pb-2 font-display text-lg font-semibold">Price index</h2>
        <div className="space-y-1.5">
          {indices.map((i) => (
            <button
              key={i.game}
              type="button"
              onClick={() => setGame(i.game)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left transition-colors",
                game === i.game && "ring-1 ring-primary/60",
              )}
            >
              <TcgLogo game={i.game} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{i.name}</span>
                <span className="block text-[11px] text-muted-foreground">
                  Index {i.index.toLocaleString()}
                </span>
              </span>
              <PriceDelta value={i.change} />
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Indices are weighted baskets of the most traded singles per game, rebased to 1,000
          at launch. Pokémon uses live catalogue pricing; other games are modelled until
          their catalogues are ingested.
        </p>
      </section>

      <section className="mt-5 px-4">
        <div className="glass-panel rounded-3xl p-4">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-2.5">
              <TcgLogo game={active.game} />
              <div>
                <p className="text-xs text-muted-foreground">{active.name} index</p>
                <p className="font-display text-3xl font-bold tabular-nums">
                  {active.index.toLocaleString()}
                </p>
              </div>
            </div>
            <PriceDelta value={active.change} />
          </div>
          <div className="mt-2">
            <TrendAreaChart data={active.series} prefix="" />
          </div>
          <div className="mt-2">
            <RangeToggle value={range} onChange={setRange} ranges={ALL_RANGES} />
          </div>
        </div>
      </section>

      <section className="mt-6 px-4">
        <h2 className="font-display text-lg font-semibold">Top movers</h2>
        <div className="mt-2 space-y-2">
          <div className="flex gap-1 rounded-xl bg-surface-2/70 p-1">
            {WINDOWS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWin(w.id)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors",
                  win === w.id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 gap-1 rounded-xl bg-surface-2/70 p-1">
              {(["EN", "JP"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={cn(
                    "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors",
                    lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {l === "EN" ? "English" : "Japanese"}
                </button>
              ))}
            </div>
            <div className="flex flex-1 gap-1 rounded-xl bg-surface-2/70 p-1">
              {(["market", "portfolio"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={cn(
                    "flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize transition-colors",
                    scope === s ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {s === "market" ? "Market" : "My cards"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {movers.isLoading ? (
          <div className="grid h-24 place-items-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <>
            {movers.data?.estimated && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Showing modelled moves — daily price snapshots are still building history for
                this window.
              </p>
            )}
            <MoverList title="Gainers" rows={movers.data?.gainers ?? []} />
            <MoverList title="Losers" rows={movers.data?.losers ?? []} />
          </>
        )}
      </section>
    </main>
  );
}

function MoverList({ title, rows }: { title: string; rows: MoverRow[] }) {
  return (
    <div className="mt-4">
      <h3 className="pb-2 text-sm font-semibold text-muted-foreground">{title}</h3>
      <div className="space-y-2">
        {rows.map((m) => (
          <Link
            key={`${m.cardId}-${title}`}
            to="/card/$cardId"
            params={{ cardId: m.cardId }}
            className="flex items-center gap-3 rounded-2xl bg-surface/60 p-2.5"
          >
            {m.image ? (
              <img src={m.image} alt="" loading="lazy" className="h-14 w-10 rounded-lg object-cover" />
            ) : (
              <span className="h-14 w-10 rounded-lg bg-surface-2" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{m.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {m.setName} · {m.number} · {m.language}
              </span>
            </span>
            <span className="shrink-0 space-y-1 text-right">
              <span className="block text-sm font-bold tabular-nums">{money(m.price)}</span>
              <PriceDelta value={m.change} />
            </span>
          </Link>
        ))}
        {!rows.length && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nothing tracked in this window yet.
          </p>
        )}
      </div>
    </div>
  );
}
