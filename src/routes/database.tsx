import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useCollection } from "@/lib/tcg/collection";
import { listRarities, listSets, searchCards, type DbSet } from "@/lib/catalog/queries";
import { CardTile, PageHeader } from "@/components/tcg/CardBits";
import { cn } from "@/lib/utils";

const PRICE_BANDS: { id: string; label: string; min: number | null; max: number | null }[] = [
  { id: "all", label: "Any market price", min: null, max: null },
  { id: "u5", label: "Under $5", min: null, max: 5 },
  { id: "5-25", label: "$5 – $25", min: 5, max: 25 },
  { id: "25-100", label: "$25 – $100", min: 25, max: 100 },
  { id: "100-500", label: "$100 – $500", min: 100, max: 500 },
  { id: "500+", label: "$500 and up", min: 500, max: null },
];

/** Japanese sets are labelled with their English name where we have one. */
function setLabel(s: DbSet) {
  return s.english_name ?? s.name;
}

export const Route = createFileRoute("/database")({
  head: () => ({
    meta: [
      { title: "Card Database — Vaultra" },
      {
        name: "description",
        content:
          "Search every English and Japanese Pokémon card ever released, including promos, by name, set name or set number — with market prices.",
      },
      { property: "og:title", content: "Card Database — Vaultra" },
      {
        property: "og:description",
        content:
          "Every English and Japanese Pokémon card, including promos, searchable by name or set number.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DatabasePage,
});

function DatabasePage() {
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<"all" | "EN" | "JP">("all");
  const [setId, setSetId] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [promoOnly, setPromoOnly] = useState(false);
  const [priceBand, setPriceBand] = useState("all");
  const [page, setPage] = useState(0);
  const { add } = useCollection();

  const setsQuery = useQuery({
    queryKey: ["sets", lang],
    queryFn: () => listSets(lang),
    staleTime: 60 * 60 * 1000,
  });
  const raritiesQuery = useQuery({
    queryKey: ["rarities", lang],
    queryFn: () => listRarities(lang),
    staleTime: 60 * 60 * 1000,
  });

  const band = PRICE_BANDS.find((b) => b.id === priceBand);
  const args = {
    query: q,
    language: lang,
    setId,
    rarity,
    promoOnly,
    minPrice: band?.min ?? null,
    maxPrice: band?.max ?? null,
    page,
    pageSize: 40,
  };
  const results = useQuery({
    queryKey: ["cards", args],
    queryFn: () => searchCards(args),
    placeholderData: keepPreviousData,
  });

  const sets = setsQuery.data ?? [];
  const selectedSet = useMemo(() => sets.find((s) => s.id === setId), [sets, setId]);
  const cards = results.data?.cards ?? [];
  const term = q.trim().toLowerCase();
  const matchingSets = useMemo(
    () =>
      term.length > 1 && setId === "all"
        ? sets
            .filter((s) => setLabel(s).toLowerCase().includes(term))
            .slice(0, 6)
        : [],
    [sets, term, setId],
  );
  const total = results.data?.total ?? 0;

  function reset<T>(fn: (v: T) => void) {
    return (v: T) => {
      setPage(0);
      fn(v);
    };
  }

  return (
    <main>
      <PageHeader
        title="Database"
        subtitle={
          results.isLoading
            ? "Searching…"
            : selectedSet
              ? `${setLabel(selectedSet)} · ${total.toLocaleString()} cards`
              : `${total.toLocaleString()} cards`
        }
      />

      <div className="space-y-3 px-4">
        <label className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => reset(setQ)(e.target.value)}
            placeholder="Card name, set name or number (e.g. Umbreon, SV4a 205)"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {results.isFetching && (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          )}
        </label>

        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {(["all", "EN", "JP"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                reset(setLang)(l);
                setSetId("all");
                setRarity("all");
              }}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                lang === l
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2 text-muted-foreground",
              )}
            >
              {l === "all" ? "All languages" : l === "EN" ? "English" : "Japanese"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => reset(setPromoOnly)(!promoOnly)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              promoOnly
                ? "bg-accent text-accent-foreground"
                : "bg-surface-2 text-muted-foreground",
            )}
          >
            Promos
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={setId}
            onChange={(e) => reset(setSetId)(e.target.value)}
            className="rounded-xl bg-surface px-3 py-2.5 text-xs font-medium outline-none"
          >
            <option value="all">All sets ({sets.length})</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.language} · {setLabel(s)}
                {s.total ? ` (${s.total})` : ""}
              </option>
            ))}
          </select>
          <select
            value={rarity}
            onChange={(e) => reset(setRarity)(e.target.value)}
            className="rounded-xl bg-surface px-3 py-2.5 text-xs font-medium outline-none"
          >
            <option value="all">All rarities</option>
            {(raritiesQuery.data ?? []).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={priceBand}
            onChange={(e) => reset(setPriceBand)(e.target.value)}
            className="col-span-2 rounded-xl bg-surface px-3 py-2.5 text-xs font-medium outline-none"
          >
            {PRICE_BANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedSet && (
        <div className="mt-4 flex items-center gap-3 px-4">
          {selectedSet.logo_url && (
            <img
              src={selectedSet.logo_url}
              alt={`${setLabel(selectedSet)} logo`}
              className="h-10 w-auto max-w-28 object-contain"
              loading="lazy"
            />
          )}
          <div className="min-w-0 text-xs text-muted-foreground">
            <p className="truncate font-semibold text-foreground">{setLabel(selectedSet)}</p>
            <p className="truncate">
              {[selectedSet.series, selectedSet.release_date, `${selectedSet.total ?? "?"} cards`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
      )}

      {matchingSets.length > 0 && (
        <div className="mt-4 px-4">
          <p className="pb-1.5 text-[11px] font-semibold text-muted-foreground">
            Jump to a full set
          </p>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {matchingSets.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSetId(s.id);
                  setQ("");
                  setPage(0);
                }}
                className="shrink-0 rounded-full bg-surface px-3.5 py-1.5 text-xs font-semibold"
              >
                {s.language} · {setLabel(s)}
                {s.total ? ` (${s.total})` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 px-4">
        {cards.map((c) => (
          <div key={c.id} className="relative">
            <CardTile card={c} sub={c.rarity} />
            <button
              type="button"
              aria-label={`Add ${c.name} to portfolio`}
              onClick={() => {
                add(c.id, "Near Mint");
                toast.success(`${c.name} added to your portfolio`);
              }}
              className="absolute top-2 right-2 grid size-8 place-items-center rounded-xl bg-background/75 text-primary backdrop-blur-md active:scale-95"
            >
              <Plus className="size-4" />
            </button>
          </div>
        ))}
      </section>

      {results.isError && (
        <p className="px-4 py-10 text-center text-sm text-destructive">
          Couldn't load the catalogue. Pull down to retry.
        </p>
      )}
      {!results.isLoading && !cards.length && !results.isError && (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Nothing found. Try a different set, number or spelling.
        </p>
      )}

      {total > 40 && (
        <div className="mt-6 flex items-center justify-between gap-3 px-4">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-xl bg-surface px-4 py-2.5 text-xs font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {Math.max(1, Math.ceil(total / 40))}
          </span>
          <button
            type="button"
            disabled={(page + 1) * 40 >= total}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl bg-surface px-4 py-2.5 text-xs font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
}
