import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PriceSource } from "@/lib/tcg/types";
import { SOURCE_META } from "@/lib/tcg/types";
import { money } from "@/components/tcg/CardBits";

function fmtDate(iso: string, compact = true) {
  const d = new Date(iso);
  return compact
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" });
}

function compact(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
}

const axis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 10,
  tickLine: false,
  axisLine: false,
};

export function MultiSourceChart({
  data,
  sources,
}: {
  data: Record<string, string | number>[];
  sources: PriceSource[];
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(v) => fmtDate(String(v))} minTickGap={32} {...axis} />
          <YAxis tickFormatter={(v) => `$${v}`} width={52} {...axis} />
          <Tooltip
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelFormatter={(v) => fmtDate(String(v), false)}
            formatter={(value, name) => [
              money(Number(value)),
              SOURCE_META[name as PriceSource]?.label ?? String(name),
            ]}
          />
          {sources.map((s) => (
            <Line
              key={s}
              type="monotone"
              dataKey={s}
              stroke={SOURCE_META[s].color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendAreaChart({
  data,
  color = "var(--color-primary)",
  height = 180,
  prefix = "$",
}: {
  data: { date: string; value: number }[];
  color?: string;
  height?: number;
  prefix?: string;
}) {
  const id = `grad-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tickFormatter={(v) => fmtDate(String(v))} minTickGap={40} {...axis} />
          <YAxis
            width={46}
            domain={["auto", "auto"]}
            tickFormatter={(v) => `${prefix}${compact(Number(v))}`}
            {...axis}
          />

          <Tooltip
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelFormatter={(v) => fmtDate(String(v), false)}
            formatter={(value) => [`${prefix}${Number(value).toLocaleString()}`, "Value"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${id})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
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
  return (
    <div className="h-10 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.8} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
