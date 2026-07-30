import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getCardPrices,
  getMovers,
  loadCard,
  type CardPricePayload,
  type MoverWindow,
} from "./history.server";

const rangeSchema = z.enum(["1D", "1W", "1M", "3M", "1Y", "5Y", "ALL"]);

export const fetchCardPrices = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ cardId: z.string(), range: rangeSchema }).parse(data),
  )
  .handler(async ({ data }): Promise<CardPricePayload | null> => {
    const card = await loadCard(data.cardId);
    if (!card) return null;
    return getCardPrices(card, data.range);
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
