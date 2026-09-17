import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Loader2 } from "lucide-react";
import { fetchTcggoProduct } from "@/lib/prices/tcggo.functions";
import { money } from "@/components/tcg/CardBits";

export const Route = createFileRoute("/product/$productId")({
  head: () => ({
    meta: [
      { title: "Sealed Product — Vaultra" },
      {
        name: "description",
        content: "Published market price and release details for a sealed Pokémon TCG product.",
      },
      { property: "og:title", content: "Sealed Product — Vaultra" },
      {
        property: "og:description",
        content: "Published market price and release details for a sealed Pokémon TCG product.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { productId } = Route.useParams();
  const getProduct = useServerFn(fetchTcggoProduct);
  const product = useQuery({
    queryKey: ["tcggo-product", productId],
    queryFn: () => getProduct({ data: { productId: Number(productId) } }),
    staleTime: 30 * 60 * 1000,
  });

  const p = product.data;

  return (
    <div className="pb-24">
      <div className="flex items-center gap-2 px-4 pt-6">
        <Link to="/products" className="grid size-9 place-items-center rounded-full bg-surface">
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="font-display text-lg font-semibold">Sealed product</h1>
      </div>

      {product.isLoading ? (
        <div className="grid h-48 place-items-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : p ? (
        <div className="mt-4 px-4">
          <div className="grid place-items-center rounded-2xl bg-surface p-6">
            {p.image ? (
              <img src={p.image} alt={p.name} className="max-h-64 object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">No image published</span>
            )}
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold">{p.name}</h2>
          <p className="text-sm text-muted-foreground">
            {p.episode ?? "Unknown expansion"}
            {p.releasedAt ? ` · released ${new Date(p.releasedAt).toLocaleDateString()}` : ""}
            {` · ${p.lang.toUpperCase()}`}
          </p>
          <div className="mt-4 rounded-2xl bg-surface p-4">
            <p className="text-xs text-muted-foreground">Lowest published asking price</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {p.priceUsd != null ? money(p.priceUsd) : "No data"}
            </p>
          </div>
          {p.url ? (
            <a
              href={p.url}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 block rounded-2xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground"
            >
              View listings
            </a>
          ) : null}
        </div>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          No data published for this product.
        </p>
      )}
    </div>
  );
}
