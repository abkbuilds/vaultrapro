/**
 * Price charts.
 *
 * Built on the Bklit chart primitives (visx + motion) so every card's price
 * history draws in with a clip-reveal, springs its y-domain when the range
 * toggle changes, and gets a crosshair tooltip on touch.
 */
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Grid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  ChartTooltip,
} from "@/components/charts";
import type { PriceSource } from "@/lib/tcg/types";
import { SOURCE_META } from "@/lib/tcg/types";
import { money } from "@/components/tcg/CardBits";

function symbolFor(currency = "USD") {
  return currency === "EUR" ? "\u20ac" : currency === "JPY" ? "\u00a5" : "$";
}

function fmtAxis(value: number, symbol: string) {
  if (value >= 1000) return `${symbol}${(value / 1000).toFixed(1)}k`;
  return `${symbol}${value >= 10 ? Math.round(value) : value.toFixed(2)}`;
}

const ENTER = { type: "spring", stiffness: 90, damping: 20, mass: 0.9 } as const;

export function MultiSourceChart({
  data,
  sources,
  currencies = {},
  loading = false,
  height = 224,
}: {
  data: Record<string, string | number>[];
  sources: PriceSource[];
  /** Currency per source, so EUR (Cardmarket) and JPY series stay honest. */
  currencies?: Partial<Record<PriceSource, string>>;
  loading?: boolean;
  height?: number;
}) {
  const symbol = symbolFor(currencies[sources[0]] ?? "USD");
  const rows = useMemo(
    () => data.map((d) => ({ ...d, date: new Date(String(d.date)) })),
    [data],
  );

  return (
    <LineChart
      data={rows}
      xDataKey="date"
      status={loading ? "loading" : "ready"}
      animationDuration={1100}
      enterTransition={ENTER}
      revealSignature={`${sources.join(",")}:${rows.length}`}
      margin={{ top: 16, right: 14, bottom: 26, left: 44 }}
      style={{ aspectRatio: "auto", height }}
      className="w-full"
    >
      <Grid horizontal shimmer />
      {sources.map((s) => (
        <Line
          key={s}
          dataKey={s}
          stroke={SOURCE_META[s].color}
          strokeWidth={2}
        />
      ))}
      <YAxis numTicks={4} formatValue={(v) => fmtAxis(v, symbol)} />
      <XAxis numTicks={4} />
      <ChartTooltip
        rows={(point) =>
          sources
            .filter((s) => point[s] != null)
            .map((s) => ({
              color: SOURCE_META[s].color,
              label: SOURCE_META[s].label,
              value: money(Number(point[s]), currencies[s] ?? "USD"),
            }))
        }
      />
    </LineChart>
  );
}

export function TrendAreaChart({
  data,
  color = "var(--color-primary)",
  height = 180,
  prefix = "$",
  loading = false,
  label = "Market value",
}: {
  data: { date: string; value: number }[];
  color?: string;
  height?: number;
  prefix?: string;
  loading?: boolean;
  label?: string;
}) {
  const rows = useMemo(
    () => data.map((d) => ({ date: new Date(d.date), value: d.value })),
    [data],
  );

  return (
    <AreaChart
      data={rows}
      xDataKey="date"
      status={loading ? "loading" : "ready"}
      loadingLabel="Loading price history"
      animationDuration={1100}
      enterTransition={ENTER}
      revealSignature={`${color}:${rows.length}:${rows[0]?.date.getTime() ?? 0}`}
      yDomainTween
      margin={{ top: 16, right: 12, bottom: 26, left: 44 }}
      style={{ aspectRatio: "auto", height }}
      className="w-full"
    >
      <Grid horizontal shimmer />
      <Area
        dataKey="value"
        fill={color}
        stroke={color}
        fillOpacity={0.32}
        gradientToOpacity={0}
        strokeWidth={2.25}
        fadeEdges
      />
      <YAxis numTicks={4} formatValue={(v) => fmtAxis(v, prefix)} />
      <XAxis numTicks={4} />
      <ChartTooltip
        indicatorColor={color}
        indicatorDasharray="4,4"
        rows={(point) => [
          {
            color,
            label,
            value: `${prefix}${Number(point.value).toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}`,
          },
        ]}
      />
    </AreaChart>
  );
}

export function Sparkline({
  data,
  positive,
}: {
  data: { date: string; value: number }[];
  positive: boolean;
}) {
  const color = positive ? "var(--color-success)" : "var(--color-destructive)";
  const rows = useMemo(
    () => data.map((d) => ({ date: new Date(d.date), value: d.value })),
    [data],
  );
  return (
    <LineChart
      data={rows}
      xDataKey="date"
      animationDuration={900}
      margin={{ top: 4, right: 2, bottom: 4, left: 2 }}
      style={{ aspectRatio: "auto", height: 40 }}
      className="w-20"
    >
      <Line dataKey="value" stroke={color} strokeWidth={1.8} />
    </LineChart>
  );
}
