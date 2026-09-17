import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { fetchTcggoArtists } from "@/lib/prices/tcggo.functions";
import { PageHeader } from "@/components/tcg/CardBits";

export const Route = createFileRoute("/artists")({
  head: () => ({
    meta: [
      { title: "Card Artists — Vaultra" },
      {
        name: "description",
        content:
          "Browse every Pokémon TCG illustrator and the cards they painted, ranked by real market price.",
      },
      { property: "og:title", content: "Card Artists — Vaultra" },
      {
        property: "og:description",
        content: "Every Pokémon TCG illustrator and the cards they painted.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArtistsPage,
});

function ArtistsPage() {
  const [page, setPage] = useState(1);
  const getArtists = useServerFn(fetchTcggoArtists);
  const artists = useQuery({
    queryKey: ["tcggo-artists", page],
    queryFn: () => getArtists({ data: { page } }),
    placeholderData: keepPreviousData,
    staleTime: 60 * 60 * 1000,
  });

  const rows = artists.data?.data ?? [];
  const paging = artists.data?.paging;

  return (
    <div className="pb-24">
      <PageHeader
        title="Artists"
        subtitle={paging ? `Page ${paging.current} of ${paging.total}` : "Loading…"}
      />

      {artists.isLoading ? (
        <div className="grid h-40 place-items-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 px-4">
          {rows.map((a) => (
            <li key={a.id}>
              <Link
                to="/artist/$artistId"
                params={{ artistId: String(a.id) }}
                className="block rounded-2xl bg-surface px-3 py-3 text-sm font-medium"
              >
                {a.name}
              </Link>
            </li>
          ))}
        </ul>
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
