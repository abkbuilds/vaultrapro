import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { PageHeader, PriceDelta, money } from "@/components/tcg/CardBits";
import { TcgLogo } from "@/components/tcg/TcgLogo";
import { fetchMarketPulse, fetchMovers } from "@/lib/prices/prices.functions";
import type { MoverRow } from "@/lib/prices/history.server";
import { useCollection } from "@/lib/tcg/collection";
import { GAMES } from "@/lib/tcg/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trends")({
  head: () => ({
    meta: [
      { title: "TCG Market Trends & Top Movers — Vaultra" },
      {
        name: "description",
        content:
          "Real, source-backed Pokémon market movement for English and Japanese cards — daily, weekly and monthly gainers and losers from recorded marketplace readings.",
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

function TrendsPage() {
  // Weekly is the shortest window with broad recorded coverage, so it is the
  // honest default rather than an empty "today" board.
  const [win, setWin] = useState<(typeof WINDOWS)[number]["id"]>("7d");

  const [lang, setLang] = useState<"EN" | "JP">("EN");
  const [scope, setScope] = useState<"market" | "portfolio">("market");
  const { entries } = useCollection();

  const portfolioIds = useMemo(
    () => [...new Set(entries.map((e) => e.cardId))],
    [entries],
  );

  const getPulse = useServerFn(fetchMarketPulse);
  const pulse = useQuery({
    queryKey: ["market-pulse", win],
    queryFn: () => getPulse({ data: { window: win } }),
    staleTime: 5 * 60 * 1000,
  });

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

  const windowLabel = WINDOWS.find((w) => w.id === win)!.label.toLowerCase();

  return (
    <main>
      <PageHeader
        title="Market"
        subtitle="Movement measured from recorded marketplace readings"
      />

      <section className="mt-1 px-4">
        <h2 className="pb-2 font-display text-lg font-semibold">Price index</h2>
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

        <div className="mt-2 space-y-1.5">
          {GAMES.map((g) => {
            const isPokemon = g.id === "pokemon";
            const en = pulse.data?.en;
            const jp = pulse.data?.jp;
            return (
              <div
                key={g.id}
                className="flex items-center gap-3 rounded-2xl bg-surface p-3 text-left"
              >
                <TcgLogo game={g.id} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{g.name}</p>
                  {isPokemon ? (
                    <p className="text-[11px] text-muted-foreground">
                      {pulse.isLoading
                        ? "Loading…"
                        : (en?.tracked ?? 0) + (jp?.tracked ?? 0) === 0
                          ? "No recorded readings yet"
                          : `${((en?.tracked ?? 0) + (jp?.tracked ?? 0)).toLocaleString()} cards with readings ${windowLabel}`}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      No data — catalogue not tracked yet
                    </p>
                  )}
                </div>
                {isPokemon ? (
                  <div className="shrink-0 space-y-1 text-right">
                    <PulseValue label="EN" change={en?.averageChange ?? null} />
                    <PulseValue label="JP" change={jp?.averageChange ?? null} />
                  </div>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">—</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          The index is the average observed price change across every tracked card with a
          real recorded reading in the selected window. Games without an ingested
          catalogue show “no data” rather than an estimate.
        </p>
      </section>

      <section className="mt-6 px-4">
        <h2 className="font-display text-lg font-semibold">Top movers</h2>
        <div className="mt-2 flex gap-2">
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

        {movers.isLoading ? (
          <div className="grid h-24 place-items-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : movers.isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            Couldn't load market movement. Try again shortly.
          </p>
        ) : (
          <>
            <MoverList title="Gainers" rows={movers.data?.gainers ?? []} />
            <MoverList title="Losers" rows={movers.data?.losers ?? []} />
          </>
        )}
      </section>
    </main>
  );
}

function PulseValue({ label, change }: { label: string; change: number | null }) {
  return (
    <span className="flex items-center justify-end gap-1.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {change == null ? (
        <span className="text-xs text-muted-foreground">No data</span>
      ) : (
        <PriceDelta value={change} />
      )}
    </span>
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
            No data — no recorded price movement in this window yet.
          </p>
        )}
      </div>
    </div>
  );
}
