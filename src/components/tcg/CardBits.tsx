import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { TcgCard } from "@/lib/tcg/types";
import artworkUnavailable from "@/assets/card-artwork-unavailable.png";

export function CardImage({
  card,
  className,
}: {
  card: TcgCard;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [card.image]);
  const showArt = Boolean(card.image) && !failed;

  return (
    <div
      className={cn(
        "relative aspect-[63/88] overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border/70",
        className,
      )}
    >
      {showArt ? (
        <img
          src={card.image}
          alt={`${card.name} — ${card.setName} ${card.number}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        // Keep the catalogue visually complete without substituting or
        // generating artwork for a real printing that has no verified scan.
        <div className="relative size-full bg-surface text-center">
          <img
            src={artworkUnavailable}
            alt=""
            aria-hidden="true"
            loading="lazy"
            width={768}
            height={1056}
            className="size-full object-cover"
          />
          <div className="absolute inset-x-[9%] bottom-[7%] rounded-lg border border-white/10 bg-black/65 px-2 py-1.5 backdrop-blur-md">
            <span className="block line-clamp-2 text-[9px] font-semibold leading-tight text-white">
              {card.name}
            </span>
            <span className="mt-0.5 block text-[7px] uppercase tracking-[0.12em] text-white/60">
              {card.setCode} {card.number} · artwork unavailable
            </span>
          </div>
        </div>
      )}
      <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/45 to-transparent opacity-60" />
    </div>
  );
}


export const PRINTING_LABEL: Record<string, string> = {
  holofoil: "Holo",
  reverse_holofoil: "Reverse holo",
};

/** Marks an entry as the holofoil or reverse holofoil printing of a card. */
export function PrintingBadge({ card, className }: { card: TcgCard; className?: string }) {
  const label = card.printing ? PRINTING_LABEL[card.printing] : undefined;
  if (!label) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary",
        className,
      )}
    >
      {label}
    </span>
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
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold">{card.name}</p>
          <PrintingBadge card={card} className="shrink-0" />
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          {card.setCode} — {card.number} · {card.language}
        </p>
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-sm font-bold">
            <Price value={card.marketPrice} />
          </span>
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
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold">{card.name}</p>
          <PrintingBadge card={card} className="shrink-0" />
        </div>
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
