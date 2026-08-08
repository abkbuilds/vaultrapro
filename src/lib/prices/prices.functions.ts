import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getCardPrices,
  getMarketPulse,
  getMovers,
  getPortfolioSeries,
  loadCard,
  type CardPricePayload,
  type MoverWindow,
} from "./history.server";

const rangeSchema = z.enum(["1D", "1W", "1M", "3M", "1Y", "5Y", "ALL"]);

/** Completed sale history + the market price derived from the last 5–10 sales. */
export const fetchCardSales = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ cardId: z.string(), limit: z.number().min(1).max(100).optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { getSales, marketPriceFrom, saleSourcesFor } = await import("./sales.server");
    const card = await loadCard(data.cardId);
    const sales = await getSales(data.cardId, data.limit ?? 25);
    return {
      sales,
      market: marketPriceFrom(sales),
      sources: saleSourcesFor(card?.language ?? "EN"),
    };
  });


export const fetchCardPrices = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ cardId: z.string(), range: rangeSchema }).parse(data),
  )
  .handler(async ({ data }): Promise<CardPricePayload | null> => {
    const card = await loadCard(data.cardId);
    if (!card) return null;
    return getCardPrices(card, data.range);
  });

/** Real % movement over 1W / 1M / 3M / 1Y / 5Y, plus TCGplayer price tiers. */
export const fetchCardTrend = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ cardId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const [{ getCardTrend }, { fetchPriceTiers }] = await Promise.all([
      import("./trend.server"),
      import("./tiers.server"),
    ]);
    const card = await loadCard(data.cardId);
    const [windows, tiers] = await Promise.all([
      getCardTrend(data.cardId),
      fetchPriceTiers(data.cardId, {
        setCode: card?.setCode ?? null,
        number: card?.number ?? null,
        language: card?.language ?? null,
      }),
    ]);

    return { windows, tiers };
  });



export const fetchMovers = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        window: z.enum(["24h", "7d", "30d"]),
        language: z.enum(["EN", "JP"]),
        limit: z.number().min(1).max(25).optional(),
        cardIds: z.array(z.string()).max(400).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) =>
    getMovers({
      window: data.window as MoverWindow,
      language: data.language,
      limit: data.limit,
      cardIds: data.cardIds,
    }),
  );

export const fetchMarketPulse = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        window: z.enum(["24h", "7d", "30d"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const [en, jp] = await Promise.all([
      getMarketPulse("EN", data.window as MoverWindow),
      getMarketPulse("JP", data.window as MoverWindow),
    ]);
    return { en, jp };
  });

export const fetchPortfolioSeries = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        days: z.number().min(1).max(3650),
        holdings: z
          .array(
            z.object({
              cardId: z.string(),
              quantity: z.number().min(0).max(10000),
              multiplier: z.number().min(0).max(5),
            }),
          )
          .max(500),
      })
      .parse(data),
  )
  .handler(async ({ data }) => getPortfolioSeries(data.holdings, data.days));
