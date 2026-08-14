import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Handshake, Heart, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { getCard } from "@/lib/tcg/cards";
import { fetchCardById } from "@/lib/catalog/queries";
import {
  fetchCardPrices,
  fetchCardSales,
  fetchCardTrend,
} from "@/lib/prices/prices.functions";

interface TrendWindow {
  days: number;
  label: string;
  pct: number;
  fromPrice: number;
  toPrice: number;
  fromDate: string;
}


import {
  CONDITIONS,
  SOURCE_META,
  type Condition,
  type PriceSource,
  type TimeRange,
} from "@/lib/tcg/types";
import { MultiSourceChart, TrendAreaChart } from "@/components/tcg/Charts";
import { RangeToggle } from "@/components/tcg/RangeToggle";
import { CardImage, PriceDelta, money } from "@/components/tcg/CardBits";
import { useCollection } from "@/lib/tcg/collection";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/card/$cardId")({
  loader: async ({ params }) => {
    const card = (await fetchCardById(params.cardId)) ?? getCard(params.cardId);
    if (!card) throw notFound();
    return { card };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Card unavailable — Vaultra" }, { name: "robots", content: "noindex" }],
      };
    }
    const { card } = loaderData;
    const title = `${card.name} · ${card.setCode} ${card.number} — Vaultra`;
    const description = `${card.name} from ${card.setName} (${card.language}). Live TCGplayer, Cardmarket and eBay prices with full history.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: card.image },
        { name: "twitter:image", content: card.image },
      ],
    };
  },
  component: CardDetail,
});

const ALL_RANGES: TimeRange[] = ["1W", "1M", "3M", "1Y", "5Y", "ALL"];

function NoHistory() {
  return (
    <div className="grid h-52 place-items-center px-6 text-center text-sm text-muted-foreground">
      No recorded price history for this window yet. Only real, source-backed readings are
      charted — nothing is estimated.
    </div>
  );
}

function CardDetail() {
  const { card } = Route.useLoaderData();
  const { add, toggleWishlist, isWishlisted } = useCollection();
  const [range, setRange] = useState<TimeRange>("3M");
  const [condition, setCondition] = useState<Condition>("Near Mint");
  const [hidden, setHidden] = useState<PriceSource[]>([]);
  const [overlay, setOverlay] = useState(false);

  const getPrices = useServerFn(fetchCardPrices);
  const prices = useQuery({
    queryKey: ["card-prices", card.id, range],
    queryFn: () => getPrices({ data: { cardId: card.id, range } }),
    staleTime: 5 * 60 * 1000,
  });
  const getTrend = useServerFn(fetchCardTrend);
  const trend = useQuery({
    queryKey: ["card-trend", card.id],
    queryFn: () => getTrend({ data: { cardId: card.id } }),
    staleTime: 5 * 60 * 1000,
  });


  const getSales = useServerFn(fetchCardSales);
  const salesQuery = useQuery({
    queryKey: ["card-sales", card.id],
    queryFn: () => getSales({ data: { cardId: card.id, limit: 25 } }),
    staleTime: 5 * 60 * 1000,
  });
  const sales = salesQuery.data?.sales ?? [];
  const market = salesQuery.data?.market;


  const series = prices.data?.series ?? [];
  const allSources = series.map((s) => s.source);
  const shown = allSources.filter((s) => !hidden.includes(s));
  const currencyBySource = Object.fromEntries(series.map((s) => [s.source, s.currency]));

  // Headline price prefers a live quote (TCGplayer first, then any other live
  // source) so it can never contradict the quote table below it.
  const liveQuotes = (prices.data?.quotes ?? []).filter((q) => q.live && q.price != null);
  const headline =
    liveQuotes.find((q) => q.source === "tcgplayer")?.price ??
    liveQuotes[0]?.price ??
    card.marketPrice;
  const headlineSource = liveQuotes.find((q) => q.source === "tcgplayer") ?? liveQuotes[0];

  const chartData = useMemo(() => {
    const rows = new Map<string, Record<string, string | number>>();
    for (const s of series) {
      for (const p of s.points) {
        const row = rows.get(p.date) ?? { date: p.date };
        row[s.source] = p.value;
        rows.set(p.date, row);
      }
    }
    return [...rows.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [series]);

  const hasHistory = chartData.length > 1;

  /**
   * Rare Candy / Collectr style single "market value" line: the deepest
   * USD-denominated source we actually recorded, in priority order.
   */
  const primary = useMemo(() => {
    const order: PriceSource[] = ["tcgplayer", "cardmarket", "ebay"];
    const candidates = [...series].sort(
      (a, b) =>
        b.points.length - a.points.length || order.indexOf(a.source) - order.indexOf(b.source),
    );
    return candidates.find((s) => s.points.length > 1) ?? candidates[0] ?? null;
  }, [series]);

  const marketPoints = primary?.points ?? [];
  const marketMoved =
    marketPoints.length > 1
      ? {
          from: marketPoints[0].value,
          to: marketPoints[marketPoints.length - 1].value,
          pct:
            marketPoints[0].value > 0
              ? ((marketPoints[marketPoints.length - 1].value - marketPoints[0].value) /
                  marketPoints[0].value) *
                100
              : null,
        }
      : null;
  const marketSymbol =
    primary?.currency === "EUR" ? "\u20ac" : primary?.currency === "JPY" ? "\u00a5" : "$";


  return (
    <main>
      <div className="flex items-center justify-between px-4 pt-5">
        <Link
          to="/database"
          className="grid size-9 place-items-center rounded-xl bg-surface"
          aria-label="Back to database"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <button
          type="button"
          onClick={() => {
            toggleWishlist(card.id);
            toast(isWishlisted(card.id) ? "Removed from wishlist" : "Added to wishlist");
          }}
          aria-label="Toggle wishlist"
          className={cn(
            "grid size-9 place-items-center rounded-xl",
            isWishlisted(card.id) ? "bg-accent text-accent-foreground" : "bg-surface",
          )}
        >
          <Heart className="size-4.5" />
        </button>
      </div>

      <section className="px-4 pt-4">
        <div className="flex gap-4">
          <CardImage card={card} className="w-32 shrink-0 shadow-glow" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl leading-tight font-bold">{card.name}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {card.setName} · {card.setCode} — {card.number}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              {[card.rarity, card.language, card.type, card.hp && `${card.hp} HP`]
                .filter(Boolean)
                .map((t) => (
                  <span key={String(t)} className="rounded-md bg-surface-2 px-2 py-1">
                    {t}
                  </span>
                ))}
            </div>
            <div className="mt-3 flex items-end gap-2">
              <p className="font-display text-3xl font-bold tabular-nums">
                {market?.value != null ? money(market.value) : money(headline)}
              </p>
              <PriceDelta
                value={
                  trend.data?.windows.find((w) => w.days === 7)?.pct ?? card.change7d
                }
                className="mb-1"
              />

            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {market?.value != null
                ? `Market price · average of last ${market.sampleSize} sale${market.sampleSize === 1 ? "" : "s"}`
                : headlineSource
                  ? `${SOURCE_META[headlineSource.source].label} live quote — no completed sales recorded yet`
                  : "Last catalogue price"}
            </p>
            {market?.value != null && market.lowConfidence && (
              <span className="mt-1 inline-block rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Low confidence · fewer than 5 sales
              </span>
            )}

            {card.artist && (
              <p className="mt-1 text-[11px] text-muted-foreground">Illus. {card.artist}</p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-4 px-4">
        <TrendStrip
          windows={trend.data?.windows ?? []}
          loading={trend.isLoading}
        />
      </section>



      <section className="mt-5 px-4">
        <div className="glass-panel rounded-3xl p-3">
          <div className="flex items-start justify-between gap-3 px-1">
            <div className="min-w-0">
              <h2 className="font-display text-sm font-semibold">Market value</h2>
              <p className="mt-0.5 font-display text-2xl font-bold tabular-nums">
                {marketPoints.length
                  ? `${marketSymbol}${marketPoints[marketPoints.length - 1].value.toLocaleString()}`
                  : "—"}
              </p>
              {marketMoved?.pct != null && (
                <p
                  className={cn(
                    "text-[11px] font-semibold tabular-nums",
                    marketMoved.pct >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {marketMoved.pct >= 0 ? "▲" : "▼"} {marketSymbol}
                  {Math.abs(marketMoved.to - marketMoved.from).toFixed(2)} (
                  {Math.abs(marketMoved.pct).toFixed(2)}%){" "}
                  <span className="font-medium text-muted-foreground">
                    over {range === "ALL" ? "all time" : range}
                  </span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOverlay((v) => !v)}
              className="shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-[11px] font-semibold"
            >
              {overlay ? "Market" : "Compare sources"}
            </button>
          </div>

          <div className="mt-2">
            {prices.isLoading ? (
              <div className="grid h-52 place-items-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : prices.isError ? (
              <div className="grid h-52 place-items-center px-6 text-center text-sm text-destructive">
                Couldn't reach the price sources. Try again in a moment.
              </div>
            ) : overlay ? (
              hasHistory ? (
                <MultiSourceChart data={chartData} sources={shown} currencies={currencyBySource} />
              ) : (
                <NoHistory />
              )
            ) : marketPoints.length > 1 ? (
              <TrendAreaChart
                data={marketPoints}
                height={208}
                prefix={marketSymbol}
                color={
                  marketMoved && marketMoved.pct != null && marketMoved.pct < 0
                    ? "var(--color-destructive)"
                    : "var(--color-success)"
                }
              />
            ) : (
              <NoHistory />
            )}
          </div>

          {overlay && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {allSources.map((s) => {
                const off = hidden.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setHidden((p) => (off ? p.filter((x) => x !== s) : [...p, s]))}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-opacity",
                      off ? "bg-surface-2 opacity-45" : "bg-surface-2",
                    )}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ background: SOURCE_META[s].color }}
                    />
                    {SOURCE_META[s].label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-2">
            <RangeToggle value={range} onChange={setRange} ranges={ALL_RANGES} />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {primary
              ? `${SOURCE_META[primary.source].label} readings · `
              : ""}
            charted from real marketplace data only — gaps are left as gaps, never smoothed
            or predicted.
          </p>
        </div>
      </section>


      <section className="mt-5 px-4">
        <h2 className="pb-2 font-display text-lg font-semibold">TCGplayer price tiers</h2>
        <TiersTable
          tiers={trend.data?.tiers.tiers ?? []}
          updatedAt={trend.data?.tiers.updatedAt ?? null}
          note={trend.data?.tiers.note}
        />
      </section>

      <section className="mt-5 px-4">
        <h2 className="pb-2 font-display text-lg font-semibold">Live quotes</h2>

        <div className="overflow-hidden rounded-2xl bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {(prices.data?.quotes ?? []).map((q) => {
                const captured = series.find((s) => s.source === q.source)?.points.length ?? 0;
                return (
                  <tr key={q.source} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: SOURCE_META[q.source].color }}
                        />
                        {SOURCE_META[q.source].label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {q.live
                        ? `Live · ${captured} recorded ${captured === 1 ? "reading" : "readings"}`
                        : (q.note ?? "No data")}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {q.price == null
                        ? "—"
                        : q.currency === "JPY"
                          ? `¥${q.price.toLocaleString()}`
                          : money(q.price, q.currency)}
                    </td>
                  </tr>
                );
              })}
              {!prices.data?.quotes.length && !prices.isLoading && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">
                    No quotes available for this printing.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 px-4">
        <div className="flex items-baseline justify-between pb-2">
          <h2 className="font-display text-lg font-semibold">Sale history</h2>
          {market?.value != null && (
            <span className="text-[11px] text-muted-foreground">
              Market {money(market.value)} · last {market.sampleSize} sale
              {market.sampleSize === 1 ? "" : "s"}
              {market.lowConfidence ? " (low confidence)" : ""}
            </span>
          )}
        </div>
        <div className="overflow-hidden rounded-2xl bg-surface">
          {salesQuery.isLoading ? (
            <div className="grid h-24 place-items-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : salesQuery.isError ? (
            <p className="px-3 py-4 text-center text-xs text-destructive">
              Couldn't load sale history.
            </p>
          ) : sales.length ? (
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Sold</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Condition</th>
                  <th className="px-3 py-2 text-right font-medium">Price</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(s.soldAt).toLocaleDateString()}{" "}
                      <span className="text-muted-foreground">
                        {new Date(s.soldAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="underline decoration-dotted"
                        >
                          {SOURCE_META[s.source].label}
                        </a>
                      ) : (
                        SOURCE_META[s.source].label
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{s.condition ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {s.currency === "JPY"
                        ? `¥${s.price.toLocaleString()}`
                        : money(s.price, s.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-3 py-5 text-center text-xs text-muted-foreground">
              No completed sales recorded yet for {card.name} ({card.setCode} {card.number}).
              Sales are ingested from{" "}
              {(salesQuery.data?.sources ?? [])
                .map((s) => SOURCE_META[s].label)
                .join(" and ")}{" "}
              — nothing is estimated.
            </p>
          )}
        </div>
      </section>



      <section className="mt-5 px-4">
        <h2 className="pb-2 font-display text-lg font-semibold">Add to collection</h2>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {CONDITIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCondition(c)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                condition === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2 text-muted-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            add(card.id, condition);
            toast.success(`${card.name} (${condition}) added`);
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground active:opacity-90"
        >
          <Plus className="size-4" /> Add {condition} copy
        </button>
        <Link
          to="/trades"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-surface py-3 text-sm font-semibold"
        >
          <Handshake className="size-4" /> Log a sale or trade
        </Link>
      </section>
    </main>
  );
}

/**
 * Real observed movement per window. A window only appears when a dated
 * earlier reading exists — nothing is extrapolated to fill the gaps.
 */
function TrendStrip({
  windows,
  loading,
}: {
  windows: TrendWindow[];
  loading: boolean;
}) {
  const headline =
    windows.find((w) => w.days === 7) ??
    windows.find((w) => w.days === 30) ??
    windows[0];

  return (
    <div className="glass-panel rounded-3xl p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Price trend</h2>
        {headline ? (
          <p className="text-[11px] text-muted-foreground">
            <span
              className={cn(
                "font-semibold",
                headline.pct >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {headline.pct >= 0 ? "Rising" : "Falling"} {Math.abs(headline.pct).toFixed(1)}%
            </span>{" "}
            over {headline.label === "1W" ? "this week" : `the last ${headline.label}`}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-2 grid h-12 place-items-center text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : windows.length === 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          No earlier recorded reading yet, so no movement can be measured. Readings are
          captured daily.
        </p>
      ) : (
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
          {windows.map((w) => (
            <div
              key={w.days}
              className="min-w-[74px] shrink-0 rounded-xl bg-surface-2/70 px-2.5 py-2 text-center"
            >
              <p className="text-[10px] font-semibold text-muted-foreground">{w.label}</p>
              <p
                className={cn(
                  "text-sm font-bold tabular-nums",
                  w.pct >= 0 ? "text-success" : "text-destructive",
                )}
              >
                {w.pct >= 0 ? "+" : ""}
                {w.pct.toFixed(1)}%
              </p>
              <p className="text-[9px] text-muted-foreground tabular-nums">
                from {money(w.fromPrice)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** TCGplayer's published low / mid / high / market / direct-low tiers. */
function TiersTable({
  tiers,
  updatedAt,
  note,
}: {
  tiers: {
    variant: string;
    low: number | null;
    mid: number | null;
    high: number | null;
    market: number | null;
    directLow: number | null;
  }[];
  updatedAt: string | null;
  note?: string;
}) {
  if (!tiers.length) {
    return (
      <p className="rounded-2xl bg-surface p-3 text-xs text-muted-foreground">
        {note ?? "No TCGplayer tier data for this printing."}
      </p>
    );
  }
  const cell = (v: number | null) =>
    v == null ? <span className="text-muted-foreground">—</span> : money(v);
  return (
    <div className="overflow-hidden rounded-2xl bg-surface">
      <table className="w-full text-left text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-3 py-2 font-medium">Printing</th>
            <th className="px-2 py-2 text-right font-medium">Low</th>
            <th className="px-2 py-2 text-right font-medium">Mid</th>
            <th className="px-2 py-2 text-right font-medium">High</th>
            <th className="px-3 py-2 text-right font-medium">Market</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {tiers.map((t) => (
            <tr key={t.variant} className="border-b border-border/50 last:border-0">
              <td className="px-3 py-2 font-medium capitalize">
                {t.variant.replace(/([A-Z])/g, " $1").toLowerCase()}
              </td>
              <td className="px-2 py-2 text-right">{cell(t.low)}</td>
              <td className="px-2 py-2 text-right">{cell(t.mid)}</td>
              <td className="px-2 py-2 text-right">{cell(t.high)}</td>
              <td className="px-3 py-2 text-right font-semibold">{cell(t.market)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {updatedAt ? (
        <p className="border-t border-border/50 px-3 py-2 text-[10px] text-muted-foreground">
          TCGplayer figures published {updatedAt}
        </p>
      ) : null}
    </div>
  );
}
