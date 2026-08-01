import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { IdentifiedCard } from "./identify.server";

/** Identifies a Pokémon card from a captured camera frame (data URL JPEG). */
export const identifyCard = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        image: z
          .string()
          .startsWith("data:image/")
          .max(8_000_000, "Image too large"),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<IdentifiedCard> => {
    const { identifyCardImage } = await import("./identify.server");
    return identifyCardImage(data.image);
  });
