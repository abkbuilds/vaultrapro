/**
 * Client-callable wrappers around the TCGGO feed (RapidAPI pokemon-tcg-api).
 * Every call is metered against the shared daily ledger, so the app can never
 * exceed the plan's 15,000 request limit.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const pageSchema = z.number().int().min(1).max(200).optional();

/** Graded eBay sold medians + the most recent completed sales for one card. */
export const fetchTcggoSoldPrices = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ cardId: z.string(), offers: z.number().int().min(1).max(50).optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const [{ loadCard }, browse] = await Promise.all([
      import("./history.server"),
      import("./tcggo-browse.server"),
    ]);
    const card = await loadCard(data.cardId);
    if (!card) return { graded: [], offers: [], feedId: null };
    const feedId = await browse.tcggoIdFor({
      id: card.id,
      name: card.name,
      number: card.number,
      setCode: card.setCode ?? null,
      language: card.language,
    });
    if (!feedId) return { graded: [], offers: [], feedId: null };
    const [graded, offers] = await Promise.all([
      browse.tcggoGradedSoldPrices(feedId),
      browse.tcggoSoldOffers(feedId, { perPage: data.offers ?? 12 }),
    ]);
    return { graded, offers, feedId };
  });

/** Pulls the feed's dated market history + sold listings into our own tables. */
export const importTcggoCardHistory = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ cardId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const [{ loadCard }, { importTcggoHistory }] = await Promise.all([
      import("./history.server"),
      import("./tcggo-browse.server"),
    ]);
    const card = await loadCard(data.cardId);
    if (!card) return { ok: false as const, reason: "unknown-card" as const };
    return importTcggoHistory({
      id: card.id,
      name: card.name,
      number: card.number,
      setCode: card.setCode ?? null,
      language: card.language,
    });
  });

/** Sealed products, optionally scoped to one expansion. */
export const fetchTcggoProducts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        page: pageSchema,
        search: z.string().max(80).optional(),
        lang: z.enum(["en", "jp"]).optional(),
        episodeId: z.number().int().positive().optional(),
        sort: z.string().max(40).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const b = await import("./tcggo-browse.server");
    return data.episodeId
      ? b.tcggoEpisodeProducts(data.episodeId, { page: data.page ?? 1, sort: data.sort ?? "relevance" })
      : b.tcggoListProducts({
          page: data.page ?? 1,
          sort: data.sort ?? "relevance",
          ...(data.search ? { search: data.search } : {}),
          ...(data.lang ? { lang: data.lang } : {}),
        });
  });

export const fetchTcggoProduct = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ productId: z.number().int().positive() }).parse(data))
  .handler(async ({ data }) => {
    const { tcggoProductDetail } = await import("./tcggo-browse.server");
    return tcggoProductDetail(data.productId);
  });

/** Card artists, and their illustrated cards. */
export const fetchTcggoArtists = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ page: pageSchema }).parse(data))
  .handler(async ({ data }) => {
    const { tcggoListArtists } = await import("./tcggo-browse.server");
    return tcggoListArtists(data.page ?? 1);
  });

export const fetchTcggoArtistCards = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ artistId: z.number().int().positive(), page: pageSchema, sort: z.string().max(40).optional() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const b = await import("./tcggo-browse.server");
    const [artist, cards] = await Promise.all([
      b.tcggoArtistDetail(data.artistId),
      b.tcggoArtistCards(data.artistId, { page: data.page ?? 1, sort: data.sort ?? "price_highest" }),
    ]);
    return { artist, cards };
  });

/** Feed-side card browsing: free-text search, or every card in one expansion. */
export const fetchTcggoCards = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        page: pageSchema,
        perPage: z.number().int().min(1).max(60).optional(),
        search: z.string().max(80).optional(),
        lang: z.enum(["en", "jp"]).optional(),
        episodeId: z.number().int().positive().optional(),
        sort: z.string().max(40).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const b = await import("./tcggo-browse.server");
    return data.episodeId
      ? b.tcggoEpisodeCards(data.episodeId, {
          page: data.page ?? 1,
          perPage: data.perPage ?? 20,
          sort: data.sort ?? "card_number_lowest",
        })
      : b.tcggoListCards({
          page: data.page ?? 1,
          perPage: data.perPage ?? 20,
          sort: data.sort ?? "relevance",
          ...(data.search ? { search: data.search } : {}),
          ...(data.lang ? { lang: data.lang } : {}),
        });
  });

/** Full feed detail for one card id, including graded eBay medians. */
export const fetchTcggoCardDetail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ feedCardId: z.number().int().positive() }).parse(data))
  .handler(async ({ data }) => {
    const { tcggoCardDetail } = await import("./tcggo-browse.server");
    return tcggoCardDetail(data.feedCardId);
  });
