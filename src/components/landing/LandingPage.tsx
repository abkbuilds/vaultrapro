import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Apple,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  Gem,
  Layers,
  LineChart,
  Loader2,
  Play,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { PriceDelta, money } from "@/components/tcg/CardBits";
import { TrendAreaChart } from "@/components/tcg/Charts";
import { RangeToggle } from "@/components/tcg/RangeToggle";
import { fetchMovers, fetchPortfolioSeries } from "@/lib/prices/prices.functions";
import { RANGE_DAYS, type TimeRange } from "@/lib/tcg/types";
import { SplitText } from "@/components/motion/SplitText";
import { Magnetic } from "@/components/motion/Magnetic";
import { TiltCard } from "@/components/motion/TiltCard";

/** A real, widely held card used purely as the public market showcase. */
const SHOWCASE = { cardId: "en-base1-4", name: "Charizard", set: "Base Set · 4/102" };
const RANGES: TimeRange[] = ["1M", "3M", "1Y", "ALL"];

const FEATURES = [
  {
    icon: Boxes,
    title: "Multi-collection portfolios",
    body: "Split sealed, graded, PC and trade binders into separate collections and watch each one's value move on its own.",
  },
  {
    icon: Zap,
    title: "Live market pricing",
    body: "TCGplayer, eBay sold and Cardmarket readings refresh around the clock. Nothing is modelled — no reading, no price.",
  },
  {
    icon: Gem,
    title: "True rarity indicators",
    body: "Printed English and Japanese rarities side by side — from Common to SAR, ACE SPEC, Hyper Rare and promos.",
  },
  {
    icon: LineChart,
    title: "Historical value charts",
    body: "1W to all-time curves built only from recorded readings, with gaps left as gaps instead of smoothed lines.",
  },
];

const RARITIES = [
  { code: "C", label: "Common", tone: "text-muted-foreground" },
  { code: "RR", label: "Double Rare", tone: "text-src-tcgplayer" },
  { code: "AR", label: "Illustration", tone: "text-success" },
  { code: "SAR", label: "Special Illust.", tone: "text-accent" },
  { code: "UR", label: "Hyper Rare", tone: "text-src-pricecharting" },
];

export function LandingPage() {
  const getMovers = useServerFn(fetchMovers);
  const movers = useQuery({
    queryKey: ["landing-movers"],
    queryFn: async () => {
      const [en, jp] = await Promise.all([
        getMovers({ data: { window: "24h", language: "EN", limit: 6 } }),
        getMovers({ data: { window: "24h", language: "JP", limit: 6 } }),
      ]);
      return [...en.gainers, ...jp.gainers, ...en.losers, ...jp.losers]
        .filter((m) => typeof m.price === "number")
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 8);
    },
    staleTime: 5 * 60 * 1000,
  });

  const [range, setRange] = useState<TimeRange>("1Y");
  const getSeries = useServerFn(fetchPortfolioSeries);
  const showcase = useQuery({
    queryKey: ["landing-series", range],
    queryFn: () =>
      getSeries({
        data: {
          days: RANGE_DAYS[range],
          holdings: [{ cardId: SHOWCASE.cardId, quantity: 1, multiplier: 1 }],
        },
      }),
    staleTime: 10 * 60 * 1000,
  });
  const series = showcase.data ?? [];
  const latest = series.length ? series[series.length - 1]!.value : null;

  return (
    <main className="relative overflow-hidden pb-10">
      <Aurora />

      {/* Hero */}
      <section className="px-4 pt-6" data-reveal>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-3 py-1 text-[11px] font-semibold tracking-wide text-primary uppercase ring-1 ring-primary/30">
          <Sparkles className="size-3.5" aria-hidden />
          Source-backed pricing only
        </span>
        <h1 className="font-display mt-4 text-4xl leading-[1.05] font-bold tracking-tight">
          Treat your Pokémon cards like a{" "}
          <span className="text-gradient">real portfolio</span>.
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Vaultra tracks 44,000+ English and Japanese cards — including promos — with live
          marketplace readings, printed rarities and honest historical charts. If a price
          was never recorded, we say so instead of guessing.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            to="/auth"
            search={{ redirect: "/" }}
            className="shadow-glow flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            Start tracking free
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            to="/trends"
            className="flex items-center justify-center gap-2 rounded-xl bg-surface px-5 py-3 text-sm font-bold ring-1 ring-border"
          >
            <Play className="size-4" aria-hidden />
            See live market
          </Link>
        </div>
        <dl className="mt-6 grid grid-cols-3 gap-2">
          {[
            { k: "44,000+", v: "Cards tracked" },
            { k: "EN + JP", v: "Both markets" },
            { k: "3", v: "Live price sources" },
          ].map((s) => (
            <div key={s.v} className="glass-panel rounded-2xl px-3 py-3 text-center">
              <dt className="font-display text-lg font-bold">{s.k}</dt>
              <dd className="text-[11px] text-muted-foreground">{s.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Live ticker */}
      <section className="mt-8" data-reveal aria-label="Live 24 hour movers">
        <div className="flex items-center justify-between px-4 pb-2">
          <h2 className="font-display text-lg font-semibold">Moving right now</h2>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden />
            Live · 24h
          </span>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1" data-rail>
          {movers.isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 w-44 shrink-0 animate-pulse rounded-2xl bg-surface" />
            ))}
          {(movers.data ?? []).map((m) => (
            <Link
              key={`${m.cardId}-${m.language}`}
              to="/card/$cardId"
              params={{ cardId: m.cardId }}
              className="glass-panel flex w-44 shrink-0 flex-col justify-between rounded-2xl p-3"
            >
              <span className="flex items-center gap-2">
                {m.image ? (
                  <img
                    src={m.image}
                    alt=""
                    loading="lazy"
                    className="h-11 w-8 rounded-md object-cover"
                  />
                ) : (
                  <span className="h-11 w-8 rounded-md bg-surface-2" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{m.name}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {m.language} · {m.number}
                  </span>
                </span>
              </span>
              <span className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold tabular-nums">
                  {typeof m.price === "number" ? money(m.price) : "—"}
                </span>
                <PriceDelta value={m.change} />
              </span>
            </Link>
          ))}
          {!movers.isLoading && !(movers.data ?? []).length && (
            <p className="px-1 py-6 text-sm text-muted-foreground">
              No recorded movement in the last 24 hours.
            </p>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="mt-9 px-4" data-reveal>
        <h2 className="font-display text-xl font-semibold">Built for collectors who count</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <article key={f.title} className="glass-panel rounded-2xl p-4">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
                <f.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Rarity indicators */}
      <section className="mt-9 px-4" data-reveal>
        <div className="glass-panel rounded-3xl p-4">
          <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Layers className="size-4" aria-hidden />
            Rarity, exactly as printed
          </span>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" data-rail>
            {RARITIES.map((r) => (
              <span
                key={r.code}
                className="flex shrink-0 flex-col items-center rounded-xl bg-surface-2/70 px-3 py-2 ring-1 ring-border"
              >
                <span className={`font-display text-base font-bold ${r.tone}`}>{r.code}</span>
                <span className="text-[10px] text-muted-foreground">{r.label}</span>
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Japanese codes (C, U, R, RR, AR, SR, SAR, SSR, CHR, ACE SPEC) and English tiers are
            filtered separately, so a search means what it says on the card.
          </p>
        </div>
      </section>

      {/* Historical chart showcase */}
      <section className="mt-9 px-4" data-reveal>
        <div className="glass-panel rounded-3xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <BarChart3 className="size-3.5" aria-hidden />
                Recorded market history
              </span>
              <h2 className="font-display mt-1 text-lg font-semibold">{SHOWCASE.name}</h2>
              <p className="text-xs text-muted-foreground">{SHOWCASE.set}</p>
            </div>
            <p className="font-display text-2xl font-bold tabular-nums">
              {latest !== null ? money(latest) : "—"}
            </p>
          </div>
          <div className="mt-3">
            {showcase.isLoading ? (
              <div className="grid h-44 place-items-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" aria-hidden />
              </div>
            ) : series.length > 1 ? (
              <TrendAreaChart data={series} />
            ) : (
              <p className="grid h-44 place-items-center px-6 text-center text-sm text-muted-foreground">
                No recorded readings for this range yet.
              </p>
            )}
          </div>
          <div className="mt-3">
            <RangeToggle value={range} onChange={setRange} ranges={RANGES} />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Charted from real marketplace readings only — gaps stay gaps, never smoothed or
            predicted.
          </p>
        </div>
      </section>

      {/* Transaction preview */}
      <TransactionPreview
        options={(movers.data ?? [])
          .filter((m): m is typeof m & { price: number } => typeof m.price === "number")
          .slice(0, 3)}
        loading={movers.isLoading}
      />

      {/* Scanner strip */}
      <section className="mt-9 px-4" data-reveal>
        <Link
          to="/scan"
          className="flex items-center gap-3 rounded-2xl bg-linear-to-r from-primary/25 to-accent/20 p-4 ring-1 ring-primary/30"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ScanLine className="size-5" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold">Scan a card with your camera</span>
            <span className="block text-xs text-muted-foreground">
              AI reads the name, set symbol and number — English or Japanese
            </span>
          </span>
          <ArrowRight className="size-5 text-muted-foreground" aria-hidden />
        </Link>
      </section>

      {/* Download / CTA */}
      <section className="mt-9 px-4" data-reveal>
        <div className="glass-panel relative overflow-hidden rounded-3xl p-5 text-center">
          <span
            className="absolute -top-16 left-1/2 size-48 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl"
            aria-hidden
          />
          <h2 className="font-display relative text-2xl font-bold">Get Vaultra</h2>
          <p className="relative mt-2 text-sm text-muted-foreground">
            Install it to your home screen today — native apps are on the way. Your collection
            syncs with your free account.
          </p>
          <div className="relative mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              to="/auth"
              search={{ redirect: "/" }}
              className="shadow-glow flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
            >
              Create free account
            </Link>
            <span className="flex items-center justify-center gap-2 rounded-xl bg-surface px-5 py-3 text-sm font-semibold text-muted-foreground ring-1 ring-border">
              <Apple className="size-4" aria-hidden />
              iOS &amp; Android soon
            </span>
          </div>
          <p className="relative mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden />
            No estimated prices. No invented sales. Ever.
          </p>
        </div>
      </section>
    </main>
  );
}

function TransactionPreview({
  options,
  loading,
}: {
  options: { cardId: string; name: string; number: string; language: string; price: number }[];
  loading: boolean;
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState(1);
  const [pick, setPick] = useState(0);
  const card = options[Math.min(pick, Math.max(options.length - 1, 0))];
  const subtotal = card ? card.price * qty : null;
  const fee = subtotal !== null ? subtotal * (side === "sell" ? 0.1325 : 0) : null;
  const total = useMemo(
    () => (subtotal === null ? null : side === "sell" ? subtotal - (fee ?? 0) : subtotal),
    [subtotal, fee, side],
  );

  return (
    <section className="mt-9 px-4" data-reveal>
      <div className="glass-panel rounded-3xl p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Log a deal in seconds</h2>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Preview
          </span>
        </div>

        <div
          className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-surface-2/70 p-1"
          role="group"
          aria-label="Transaction side"
        >
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              aria-pressed={side === s}
              className={`cursor-pointer rounded-lg py-2 text-xs font-bold capitalize transition-colors ${
                side === s
                  ? s === "buy"
                    ? "bg-success text-success-foreground"
                    : "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-3 h-40 animate-pulse rounded-2xl bg-surface" />
        ) : card ? (
          <>
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" data-rail>
              {options.map((o, i) => (
                <button
                  key={o.cardId}
                  type="button"
                  onClick={() => setPick(i)}
                  aria-pressed={i === pick}
                  className={`shrink-0 cursor-pointer rounded-xl px-3 py-2 text-left text-[11px] font-semibold ring-1 transition-colors ${
                    i === pick
                      ? "bg-primary/15 text-foreground ring-primary/40"
                      : "bg-surface text-muted-foreground ring-border"
                  }`}
                >
                  <span className="block max-w-32 truncate">{o.name}</span>
                  <span className="block text-[10px] font-medium opacity-70">
                    {o.language} · {o.number}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl bg-surface p-3">
              <div>
                <p className="text-xs text-muted-foreground">Quantity</p>
                <p className="font-display text-lg font-bold tabular-nums">{qty}</p>
              </div>
              <div className="flex gap-2">
                {[-1, 1].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setQty((q) => Math.min(99, Math.max(1, q + d)))}
                    aria-label={d > 0 ? "Increase quantity" : "Decrease quantity"}
                    className="grid size-11 cursor-pointer place-items-center rounded-xl bg-surface-2 text-lg font-bold"
                  >
                    {d > 0 ? "+" : "−"}
                  </button>
                ))}
              </div>
            </div>

            <dl className="mt-3 space-y-1.5 text-sm">
              <Row label={`Market price × ${qty}`} value={subtotal} />
              {side === "sell" && <Row label="Est. marketplace fee (13.25%)" value={fee} negative />}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <dt className="text-sm font-semibold">
                  {side === "sell" ? "You receive" : "You pay"}
                </dt>
                <dd className="font-display text-xl font-bold tabular-nums">
                  {total !== null ? money(total) : "—"}
                </dd>
              </div>
            </dl>

            <Link
              to="/trades"
              className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              <BadgeCheck className="size-4" aria-hidden />
              Log this {side}
            </Link>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Figures use the card's latest recorded market reading. Nothing is bought or sold
              here — Vaultra records deals you make at shows, online or in person.
            </p>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No recorded prices available to preview right now.
          </p>
        )}
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  negative,
}: {
  label: string;
  value: number | null;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">
        {value === null ? "—" : `${negative ? "−" : ""}${money(Math.abs(value))}`}
      </dd>
    </div>
  );
}

function Aurora() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translate3d(0, ${window.scrollY * -0.08}px, 0)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 h-96">
      <div className="absolute -left-16 top-0 size-64 rounded-full bg-primary/25 blur-[90px]" />
      <div className="absolute -right-20 top-16 size-72 rounded-full bg-accent/20 blur-[100px]" />
      <div className="absolute left-1/3 top-40 size-56 rounded-full bg-src-ebay/10 blur-[90px]" />
    </div>
  );
}
