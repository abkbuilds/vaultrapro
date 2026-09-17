import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
import { fetchTcggoProducts } from "@/lib/prices/tcggo.functions";
import { PageHeader, money } from "@/components/tcg/CardBits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Sealed Products — Vaultra" },
      {
        name: "description",
        content:
          "Browse sealed Pokémon TCG products — booster boxes, elite trainer boxes and tins — with real published market prices.",
      },
      { property: "og:title", content: "Sealed Products — Vaultra" },
      {
        property: "og:description",
        content: "Sealed Pokémon TCG products with real published market prices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<"en" | "jp">("en");
  const [page, setPage] = useState(1);

  const getProducts = useServerFn(fetchTcggoProducts);
  const products = useQuery({
    queryKey: ["tcggo-products", query, lang, page],
    queryFn: () => getProducts({ data: { page, lang, ...(query ? { search: query } : {}) } }),
    placeholderData: keepPreviousData,
    staleTime: 30 * 60 * 1000,
  });

  const rows = products.data?.data ?? [];
  const paging = products.data?.paging;

  return (
    <div className="pb-24">
      <PageHeader
        title="Sealed products"
        subtitle={
          products.isLoading
            ? "Loading…"
            : paging
              ? `${paging.results} shown · page ${paging.current} of ${paging.total}`
              : undefined
        }
      />

      <div className="space-y-3 px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(term.trim());
          }}
          className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5"
        >
          <Search className="size-4 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search booster boxes, ETBs, tins…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </form>

        <div className="flex gap-2">
          {(["en", "jp"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLang(l);
                setPage(1);
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                lang === l ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground",
              )}
            >
              {l === "en" ? "English" : "Japanese"}
            </button>
          ))}
        </div>
      </div>

      {products.isLoading ? (
        <div className="grid h-40 place-items-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : rows.length ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 px-4">
          {rows.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-2xl bg-surface">
              <Link to="/product/$productId" params={{ productId: String(p.id) }} className="block">
                <div className="grid aspect-square place-items-center bg-background/40 p-3">
                  {p.image ? (
                    <img src={p.image} alt={p.name} loading="lazy" className="max-h-full object-contain" />
                  ) : (
                    <span className="text-[11px] text-muted-foreground">No image</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-xs font-medium">{p.name}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {p.episode ?? "—"}
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {p.priceUsd != null ? money(p.priceUsd) : "No data"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          No products published for this search.
        </p>
      )}

      {paging && paging.total > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3 px-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-full bg-surface px-4 py-2 text-xs font-medium disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            {paging.current} / {paging.total}
          </span>
          <button
            type="button"
            disabled={page >= paging.total}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full bg-surface px-4 py-2 text-xs font-medium disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
