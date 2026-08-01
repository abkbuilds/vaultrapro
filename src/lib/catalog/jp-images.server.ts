/**
 * Backfills card images for Japanese cards (server-only).
 *
 * TCGdex has no artwork for many older Japanese sets and promos. tcgcsv.com
 * (the free TCGplayer catalogue mirror, category 85 = "Pokemon Japan") carries
 * a real product photo for most of them, so we match by set abbreviation +
 * collector number and copy the image URL across. Nothing is generated — a card
 * with no upstream photo simply stays without one.
 */

import { baseNumber, numberKey } from "./jp-english.server";

const BASE = "https://tcgcsv.com/tcgplayer/85";

interface Group {
  groupId: number;
  abbreviation: string | null;
}

interface Product {
  productId: number;
  name: string;
  imageUrl: string | null;
  extendedData?: { name: string; value: string }[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "curl/8.7.1" },
  });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return (await res.json()) as T;
}

function sized(url: string | null, size: "200w" | "400w"): string | null {
  if (!url) return null;
  return url.replace(/_\d+w\.jpg$/, `_${size}.jpg`);
}

export interface JpImageResult {
  setsProcessed: string[];
  cardsUpdated: number;
  remainingSets: number;
  done: boolean;
}

export async function runJpImageSync(opts: {
  limit?: number;
  offset?: number;
}): Promise<JpImageResult> {
  const limit = opts.limit ?? 4;
  const offset = opts.offset ?? 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Japanese sets that still contain cards without artwork.
  const missing: { set_id: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from("tcg_cards")
      .select("set_id")
      .eq("language", "JP")
      .is("image_small", null)
      .is("image_large", null)
      .range(from, from + 999);
    const page = (data ?? []) as { set_id: string | null }[];
    missing.push(...page);
    if (page.length < 1000) break;
  }
  const pendingSets = [...new Set(missing.map((m) => m.set_id).filter(Boolean))] as string[];

  const groups = (await getJson<{ results: Group[] }>(`${BASE}/groups`)).results.filter(
    (g) => g.abbreviation,
  );
  const groupByAbbr = new Map(
    groups.map((g) => [(g.abbreviation ?? "").toUpperCase(), g.groupId]),
  );

  const batch = pendingSets.slice(offset, offset + limit);
  let cardsUpdated = 0;
  const processed: string[] = [];

  for (const setId of batch) {
    const abbr = setId.replace(/^jp-/, "").toUpperCase();
    const groupId = groupByAbbr.get(abbr);
    processed.push(abbr);
    if (!groupId) continue;

    try {
      const products = (await getJson<{ results: Product[] }>(`${BASE}/${groupId}/products`))
        .results;
      const byNumber = new Map<string, Product>();
      for (const p of products) {
        const num = baseNumber(
          p.extendedData?.find((e) => e.name === "Number")?.value ?? null,
        );
        if (num && p.imageUrl) byNumber.set(numberKey(num), p);
      }
      if (!byNumber.size) continue;

      const rows: { id: string; number: string }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await supabaseAdmin
          .from("tcg_cards")
          .select("id,number")
          .eq("set_id", setId)
          .is("image_small", null)
          .is("image_large", null)
          .range(from, from + 999);
        const page = (data ?? []) as { id: string; number: string }[];
        rows.push(...page);
        if (page.length < 1000) break;
      }

      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        await Promise.all(
          chunk.map(async (row) => {
            const p = byNumber.get(numberKey(row.number));
            if (!p) return;
            const { error } = await supabaseAdmin
              .from("tcg_cards")
              .update({
                image_small: sized(p.imageUrl, "200w"),
                image_large: sized(p.imageUrl, "400w"),
                updated_at: new Date().toISOString(),
              } as never)
              .eq("id", row.id);
            if (!error) cardsUpdated += 1;
          }),
        );
      }
    } catch (e) {
      console.error(`jp image sync failed for ${abbr}`, e);
    }
  }

  return {
    setsProcessed: processed,
    cardsUpdated,
    remainingSets: Math.max(0, pendingSets.length - offset - batch.length),
    done: pendingSets.length - offset - batch.length <= 0,
  };
}
