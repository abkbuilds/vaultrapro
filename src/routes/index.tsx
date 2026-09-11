import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Bell, Handshake, Loader2, ScanLine } from "lucide-react";
import { PageHeader, PriceDelta, CardRow, Price, money } from "@/components/tcg/CardBits";
import { TrendAreaChart } from "@/components/tcg/Charts";
import { RangeToggle } from "@/components/tcg/RangeToggle";
import { useCollection, valueEntries, holdingsOf } from "@/lib/tcg/collection";
import { fetchMovers, fetchPortfolioSeries } from "@/lib/prices/prices.functions";
import { RANGE_DAYS, type TimeRange } from "@/lib/tcg/types";
import { useAuth } from "@/lib/auth";
import { LandingPage } from "@/components/landing/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vaultra — Pokémon Card Portfolio & Price Tracker" },
      {
        name: "description",
        content:
          "Track 44,000+ English and Japanese Pokémon cards with live TCGplayer, eBay and Cardmarket readings, real rarity filters and honest historical value charts.",
      },
      { property: "og:title", content: "Vaultra — Pokémon Card Portfolio & Price Tracker" },
      {
        property: "og:description",
        content:
          "Multi-collection portfolios, live card prices, rarity indicators and source-backed value charts for English and Japanese Pokémon TCG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const RANGES: TimeRange[] = ["1D", "1M", "3M", "1Y", "ALL"];

function Home() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid h-[60vh] place-items-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  return user ? <Dashboard /> : <LandingPage />;
}

function Dashboard() {
  const { entries } = useCollection();
  const [range, setRange] = useState<TimeRange>("3M");
  const valued = useMemo(() => valueEntries(entries), [entries]);

  const total = valued.reduce((s, e) => s + e.value, 0);
  const cost = valued.reduce((s, e) => s + e.cost, 0);
  const gain = total - cost;
  const gainPct = cost ? (gain / cost) * 100 : null;

  const holdings = useMemo(() => holdingsOf(entries), [entries]);
  const getSeries = useServerFn(fetchPortfolioSeries);
  const history = useQuery({
    queryKey: ["portfolio-series", range, holdings],
    queryFn: () => getSeries({ data: { days: RANGE_DAYS[range], holdings } }),
    enabled: holdings.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const cardIds = useMemo(() => [...new Set(entries.map((e) => e.cardId))], [entries]);
  const getMovers = useServerFn(fetchMovers);
  const movers = useQuery({
    queryKey: ["my-movers", cardIds],
    queryFn: async () => {
      const [en, jp] = await Promise.all([
        getMovers({ data: { window: "24h", language: "EN", limit: 10, cardIds } }),
        getMovers({ data: { window: "24h", language: "JP", limit: 10, cardIds } }),
      ]);
      return [...en.gainers, ...en.losers, ...jp.gainers, ...jp.losers]
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 4);
    },
    enabled: cardIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const series = history.data ?? [];

  return (
    <main>
      <PageHeader
        title="Portfolio"
        subtitle="Valued from real marketplace readings"
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
            <p className="font-display text-4xl font-bold tabular-nums">
              {total > 0 ? money(total) : "—"}
            </p>
            <PriceDelta value={gainPct} className="mb-1.5" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {gain >= 0 ? "+" : "−"}
            {money(Math.abs(gain))} all-time · {valued.length} lots ·{" "}
            {valued.reduce((s, e) => s + e.quantity, 0)} cards
          </p>
          <div className="mt-3">
            {history.isLoading ? (
              <div className="grid h-40 place-items-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : series.length > 1 ? (
              <TrendAreaChart data={series} />
            ) : (
              <div className="grid h-40 place-items-center px-6 text-center text-sm text-muted-foreground">
                No recorded portfolio history yet. Your chart builds from real daily price
                readings for the cards you hold.
              </div>
            )}
          </div>
          <div className="mt-3">
            <RangeToggle value={range} onChange={setRange} ranges={RANGES} />
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
          {movers.isLoading && (
            <div className="grid h-20 place-items-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          )}
          {(movers.data ?? []).map((m) => (
            <Link
              key={m.cardId}
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
                <span className="block text-sm font-bold">
                  <Price value={m.price} />
                </span>
                <PriceDelta value={m.change} />
              </span>
            </Link>
          ))}
          {!movers.isLoading && !(movers.data ?? []).length && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {cardIds.length
                ? "No recorded movement for your cards yet."
                : "Add cards from the database to track their real price movement."}
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 px-4">
        <div className="rounded-2xl bg-surface p-4">
          <h2 className="font-display text-base font-semibold">Holdings</h2>
          <div className="mt-2 space-y-2">
            {valued.slice(0, 5).map((e) => (
              <CardRow
                key={e.id}
                card={e.card}
                sub={`${e.quantity}× ${e.condition}`}
                right={
                  <p className="text-sm font-bold">
                    <Price value={e.value} />
                  </p>
                }
              />
            ))}
            {!valued.length && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Your collection is empty. Search the database or scan a card to start.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
