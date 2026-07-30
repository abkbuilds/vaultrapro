import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { TcgCard } from "@/lib/tcg/types";

export function CardImage({
  card,
  className,
}: {
  card: TcgCard;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[63/88] overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border/70",
        className,
      )}
    >
      <img
        src={card.image}
        alt={`${card.name} — ${card.setName} ${card.number}`}
        loading="lazy"
        className="size-full object-cover"
        onError={(e) => {
          e.currentTarget.style.opacity = "0";
        }}
      />
      <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/45 to-transparent opacity-60" />
    </div>
  );
}

export function PriceDelta({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  if (value == null) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-semibold text-muted-foreground",
          className,
        )}
      >
        No data
      </span>
    );
  }
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        up ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive",
        className,
      )}
    >
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export function money(n: number, currency = "USD") {
  return n.toLocaleString(currency === "JPY" ? "ja-JP" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" || n >= 1000 ? 0 : 2,
  });
}

/** Renders a real price, or an explicit "no data" marker when none exists. */
export function Price({ value, currency }: { value: number | null | undefined; currency?: string }) {
  if (value == null || value <= 0) {
    return <span className="text-xs text-muted-foreground">No data</span>;
  }
  return <span className="tabular-nums">{money(value, currency)}</span>;
}

export function CardTile({ card, sub }: { card: TcgCard; sub?: string }) {
  return (
    <Link
      to="/card/$cardId"
      params={{ cardId: card.id }}
      className="group block space-y-2"
    >
      <CardImage
        card={card}
        className="transition-transform duration-200 group-active:scale-[0.97]"
      />
      <div className="space-y-0.5">
        <p className="truncate text-sm font-semibold">{card.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {card.setCode} — {card.number} · {card.language}
        </p>
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-sm font-bold tabular-nums">{money(card.marketPrice)}</span>
          <PriceDelta value={card.change7d} />
        </div>
        {sub ? <p className="text-[11px] text-muted-foreground">{sub}</p> : null}
      </div>
    </Link>
  );
}

export function CardRow({
  card,
  right,
  sub,
}: {
  card: TcgCard;
  right?: React.ReactNode;
  sub?: string;
}) {
  return (
    <Link
      to="/card/$cardId"
      params={{ cardId: card.id }}
      className="flex items-center gap-3 rounded-2xl bg-surface/60 p-2.5 transition-colors active:bg-surface-2"
    >
      <CardImage card={card} className="w-11 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{card.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {sub ?? `${card.setName} · ${card.setCode} ${card.number}`}
        </p>
      </div>
      <div className="shrink-0 text-right">{right}</div>
    </Link>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-3 px-4 pt-6 pb-4">
      <div>
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}
