import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { PageHeader, PriceDelta, CardImage, money } from "@/components/tcg/CardBits";
import { useCollection, valueEntries } from "@/lib/tcg/collection";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/collection")({
  head: () => ({
    meta: [
      { title: "My Collection — Vaultra" },
      {
        name: "description",
        content:
          "Every card you own with quantity, condition, cost basis and live market value.",
      },
      { property: "og:title", content: "My Collection — Vaultra" },
      {
        property: "og:description",
        content: "Browse and filter your TCG collection with live valuations.",
      },
    ],
  }),
  component: CollectionPage,
});

type Filter = "all" | "EN" | "JP" | "gainers" | "losers";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "EN", label: "English" },
  { id: "JP", label: "Japanese" },
  { id: "gainers", label: "Gainers" },
  { id: "losers", label: "Losers" },
];

function CollectionPage() {
  const { entries, remove } = useCollection();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const valued = useMemo(() => valueEntries(entries), [entries]);
  const total = valued.reduce((s, e) => s + e.value, 0);

  const visible = valued.filter((e) => {
    const matchQ =
      !q ||
      `${e.card.name} ${e.card.setName} ${e.card.number}`
        .toLowerCase()
        .includes(q.toLowerCase());
    const matchF =
      filter === "all" ||
      (filter === "EN" && e.card.language === "EN") ||
      (filter === "JP" && e.card.language === "JP") ||
      (filter === "gainers" && e.gain >= 0) ||
      (filter === "losers" && e.gain < 0);
    return matchQ && matchF;
  });

  return (
    <main>
      <PageHeader
        title="Collection"
        subtitle={`${valued.reduce((s, e) => s + e.quantity, 0)} cards · ${money(total)}`}
      />

      <div className="space-y-3 px-4">
        <label className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your cards"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2 text-muted-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-4 grid grid-cols-2 gap-3 px-4">
        {visible.map((e) => (
          <div key={e.id} className="rounded-2xl bg-surface p-2.5">
            <Link to="/card/$cardId" params={{ cardId: e.card.id }}>
              <CardImage card={e.card} />
              <p className="mt-2 truncate text-sm font-semibold">{e.card.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {e.quantity}× · {e.condition}
              </p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-sm font-bold tabular-nums">{money(e.value)}</span>
                <PriceDelta value={e.gainPct} />
              </div>
            </Link>
            <button
              type="button"
              onClick={() => remove(e.id)}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-surface-2 py-1.5 text-[11px] font-semibold text-muted-foreground"
            >
              <Trash2 className="size-3.5" /> Remove
            </button>
          </div>
        ))}
        {visible.length === 0 && (
          <p className="col-span-2 py-10 text-center text-sm text-muted-foreground">
            No cards match those filters.
          </p>
        )}
      </section>
    </main>
  );
}
