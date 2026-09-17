import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Loader2 } from "lucide-react";
import { fetchTcggoArtistCards } from "@/lib/prices/tcggo.functions";
import { money } from "@/components/tcg/CardBits";

export const Route = createFileRoute("/artist/$artistId")({
  head: () => ({
    meta: [
      { title: "Artist Cards — Vaultra" },
      {
        name: "description",
        content: "Every card illustrated by this Pokémon TCG artist, ranked by real market price.",
      },
      { property: "og:title", content: "Artist Cards — Vaultra" },
      {
        property: "og:description",
        content: "Every card illustrated by this Pokémon TCG artist, ranked by market price.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArtistPage,
});

function ArtistPage() {
  const { artistId } = Route.useParams();
  const [page, setPage] = useState(1);
  const getCards = useServerFn(fetchTcggoArtistCards);
  const result = useQuery({
    queryKey: ["tcggo-artist-cards", artistId, page],
    queryFn: () => getCards({ data: { artistId: Number(artistId), page } }),
    placeholderData: keepPreviousData,
    staleTime: 30 * 60 * 1000,
  });

  const artist = result.data?.artist;
  const rows = result.data?.cards.data ?? [];
  const paging = result.data?.cards.paging;

  return (
    <div className="pb-24">
      <div className="flex items-center gap-2 px-4 pt-6">
        <Link to="/artists" className="grid size-9 place-items-center rounded-full bg-surface">
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="font-display text-lg font-semibold">{artist?.name ?? "Artist"}</h1>
          <p className="text-xs text-muted-foreground">Ranked by published market price</p>
        </div>
      </div>

      {result.isLoading ? (
        <div className="grid h-40 place-items-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : rows.length ? (
        <ul className="mt-4 grid grid-cols-3 gap-3 px-4">
          {rows.map((c) => (
            <li key={c.id} className="overflow-hidden rounded-2xl bg-surface">
              <div className="grid aspect-[3/4] place-items-center bg-background/40">
                {c.image ? (
                  <img src={c.image} alt={c.name} loading="lazy" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">No image</span>
                )}
              </div>
              <div className="p-2">
                <p className="line-clamp-1 text-[11px] font-medium">{c.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {c.episode ?? c.lang.toUpperCase()} {c.number ? `· ${c.number}` : ""}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold tabular-nums">
                  {c.priceUsd != null ? money(c.priceUsd) : "No data"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          No cards published for this artist.
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
