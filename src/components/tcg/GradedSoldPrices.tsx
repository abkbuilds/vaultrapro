import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { fetchTcggoSoldPrices } from "@/lib/prices/tcggo.functions";
import { money } from "@/components/tcg/CardBits";

/**
 * Real completed eBay sales for one card: median price per grading company and
 * grade, plus the individual listings behind them. Nothing is estimated — when
 * the feed publishes nothing for a printing, the panel says so.
 */
export function GradedSoldPrices({ cardId }: { cardId: string }) {
  const getSold = useServerFn(fetchTcggoSoldPrices);
  const sold = useQuery({
    queryKey: ["tcggo-sold", cardId],
    queryFn: () => getSold({ data: { cardId, offers: 12 } }),
    staleTime: 30 * 60 * 1000,
  });

  const graded = sold.data?.graded ?? [];
  const offers = sold.data?.offers ?? [];

  return (
    <section className="mt-5 px-4">
      <div className="flex items-baseline justify-between pb-2">
        <h2 className="font-display text-lg font-semibold">Graded sold prices</h2>
        <span className="text-[11px] text-muted-foreground">eBay completed sales</span>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface">
        {sold.isLoading ? (
          <div className="grid h-24 place-items-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : graded.length ? (
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium">Grader</th>
                <th className="px-3 py-2 font-medium">Grade</th>
                <th className="px-3 py-2 font-medium">Sales</th>
                <th className="px-3 py-2 text-right font-medium">Median</th>
              </tr>
            </thead>
            <tbody>
              {graded.map((g) => (
                <tr key={`${g.company}-${g.grade}`} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2 font-medium">{g.company}</td>
                  <td className="px-3 py-2">{g.grade}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {g.sampleSize}
                    {g.sampleSize < 5 ? " · low confidence" : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(g.medianPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            No graded sales published for this printing.
          </p>
        )}
      </div>

      {offers.length > 0 && (
        <ul className="mt-3 space-y-2">
          {offers.map((o) => (
            <li key={o.itemId} className="rounded-2xl bg-surface p-3">
              <a
                href={o.url ?? undefined}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-3"
              >
                {o.imageUrl ? (
                  <img
                    src={o.imageUrl}
                    alt=""
                    loading="lazy"
                    className="size-12 shrink-0 rounded-lg object-cover"
                  />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-xs font-medium">{o.title}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {o.company && o.grade ? `${o.company} ${o.grade} · ` : ""}
                    {o.endedAt ? new Date(o.endedAt).toLocaleDateString() : "Date unavailable"}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs font-semibold tabular-nums">
                  {o.priceUsd != null ? money(o.priceUsd) : `${o.price} ${o.currency}`}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
