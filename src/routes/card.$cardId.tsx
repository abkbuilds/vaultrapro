import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, Heart, Plus } from "lucide-react";
import { toast } from "sonner";
import { getCard } from "@/lib/tcg/cards";
import { fetchCardById } from "@/lib/catalog/queries";
import { getCombinedSeries, getRecentListings, sourcesForCard } from "@/lib/tcg/prices";
import {
  CONDITIONS,
  SOURCE_META,
  type Condition,
  type PriceSource,
  type TimeRange,
} from "@/lib/tcg/types";
import { MultiSourceChart } from "@/components/tcg/Charts";
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
    const description = `${card.name} from ${card.setName} (${card.language}). Live TCGplayer, eBay, snkrdunk and PriceCharting prices with full history.`;
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

function CardDetail() {
  const { card } = Route.useLoaderData();
  const { add, toggleWishlist, isWishlisted } = useCollection();
  const [range, setRange] = useState<TimeRange>("3M");
  const [condition, setCondition] = useState<Condition>("Near Mint");
  const allSources = useMemo(() => sourcesForCard(card), [card]);
  const [hidden, setHidden] = useState<PriceSource[]>([]);

  const data = useMemo(() => getCombinedSeries(card, range), [card, range]);
  const listings = useMemo(() => getRecentListings(card), [card]);
  const shown = allSources.filter((s) => !hidden.includes(s));

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
            {card.nativeName && (
              <p className="text-sm text-muted-foreground">{card.nativeName}</p>
            )}
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
                {money(card.marketPrice)}
              </p>
              <PriceDelta value={card.change7d} className="mb-1" />
            </div>
            {card.artist && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Illus. {card.artist}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-5 px-4">
        <div className="glass-panel rounded-3xl p-3">
          <MultiSourceChart data={data} sources={shown} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {allSources.map((s) => {
              const off = hidden.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setHidden((p) => (off ? p.filter((x) => x !== s) : [...p, s]))
                  }
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
          <div className="mt-2">
            <RangeToggle value={range} onChange={setRange} />
          </div>
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
      </section>

      <section className="mt-6 px-4">
        <h2 className="pb-2 font-display text-lg font-semibold">Recent sales & listings</h2>
        <div className="overflow-hidden rounded-2xl bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Cond.</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {new Date(l.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: SOURCE_META[l.source].color }}
                      />
                      <span className="truncate">{SOURCE_META[l.source].label}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {l.kind}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{l.condition}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {money(l.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
