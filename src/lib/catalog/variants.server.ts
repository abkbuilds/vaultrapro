/**
 * Splits Holofoil and Reverse Holofoil printings into their own catalogue
 * entries.
 *
 * Source of truth: tcgcsv.com, the keyless mirror of the TCGplayer catalogue.
 * A separate entry is only created when TCGplayer actually lists that sub-type
 * alongside the plain printing — nothing is inferred from the set era. Its
 * price is the published market price for that exact printing, or nothing at
 * all ("no data") when TCGplayer has no listing.
 */
import {
  EN_CATEGORY,
  JP_CATEGORY,
  groupPrintings,
  listGroups,
  numberKey,
} from "@/lib/prices/tcgcsv.server";

export const REVERSE_SUFFIX = "-rh";
export const HOLO_SUFFIX = "-holo";

export interface VariantSyncResult {
  language: "EN" | "JP";
  setsProcessed: string[];
  variantsCreated: number;
  variantsPriced: number;
  remainingSets: number;
  done: boolean;
}

export async function runVariantSync(opts: {
  language?: "EN" | "JP";
  limit?: number;
  offset?: number;
}): Promise<VariantSyncResult> {
  const language = opts.language ?? "EN";
  const limit = opts.limit ?? 6;
  const offset = opts.offset ?? 0;
  const category = language === "JP" ? JP_CATEGORY : EN_CATEGORY;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const groups = (await listGroups(category)).filter((g) => g.abbreviation);

  const { data: setRows, error: setErr } = await supabaseAdmin
    .from("tcg_sets")
    .select("id,code")
    .eq("language", language);
  if (setErr) throw new Error(`set lookup failed: ${setErr.message}`);

  const setsByCode = new Map<string, string[]>();
  for (const s of (setRows ?? []) as { id: string; code: string | null }[]) {
    const code = (s.code ?? s.id.replace(/^(en|jp)-/, "")).toUpperCase();
    setsByCode.set(code, [...(setsByCode.get(code) ?? []), s.id]);
  }

  const matched = groups.filter((g) => setsByCode.has((g.abbreviation ?? "").toUpperCase()));
  const batch = matched.slice(offset, offset + limit);
  const today = new Date().toISOString().slice(0, 10);

  let variantsCreated = 0;
  let variantsPriced = 0;
  const processed: string[] = [];

  for (const group of batch) {
    const abbr = (group.abbreviation ?? "").toUpperCase();
    try {
      const printings = await groupPrintings(category, group.groupId);
      if (!printings.size) {
        processed.push(abbr);
        continue;
      }

      for (const setId of setsByCode.get(abbr) ?? []) {
        const cards: Record<string, unknown>[] = [];
        for (let from = 0; ; from += 1000) {
          const { data } = await supabaseAdmin
            .from("tcg_cards")
            .select("*")
            .eq("set_id", setId)
            .eq("variant", "normal")
            .range(from, from + 999);
          const page = (data ?? []) as unknown as Record<string, unknown>[];
          cards.push(...page);
          if (page.length < 1000) break;
        }

        const rows: Record<string, unknown>[] = [];
        const priced: { id: string; price: number }[] = [];
        for (const card of cards) {
          const baseId = String(card.id);
          const key = numberKey(String(card.number ?? ""));
          if (!reverses.has(key)) continue;
          const price = reverses.get(key) ?? null;
          const row: Record<string, unknown> = { ...card };
          delete row.search_text;
          row.id = `${baseId}${REVERSE_SUFFIX}`;
          row.base_card_id = baseId;
          row.variant = "reverse_holofoil";
          row.market_price = price;
          row.price_change_7d = null;
          row.updated_at = new Date().toISOString();
          rows.push(row);
          if (price != null) priced.push({ id: String(row.id), price });
        }

        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200);
          const { error } = await supabaseAdmin
            .from("tcg_cards")
            .upsert(chunk as never, { onConflict: "id" });
          if (error) throw new Error(error.message);
          variantsCreated += chunk.length;
        }

        for (let i = 0; i < priced.length; i += 200) {
          const chunk = priced.slice(i, i + 200);
          await supabaseAdmin.from("card_price_latest").upsert(
            chunk.map((p) => ({
              card_id: p.id,
              source: "tcgplayer",
              price: p.price,
              currency: "USD",
              updated_at: new Date().toISOString(),
            })) as never,
            { onConflict: "card_id,source" },
          );
          await supabaseAdmin.from("card_price_points").upsert(
            chunk.map((p) => ({
              card_id: p.id,
              source: "tcgplayer",
              condition: "Near Mint",
              price: p.price,
              currency: "USD",
              captured_on: today,
            })) as never,
            { onConflict: "card_id,source,condition,captured_on" },
          );
          variantsPriced += chunk.length;
        }
      }
      processed.push(abbr);
    } catch (e) {
      console.error(`variant sync failed for ${abbr}`, e);
    }
  }

  const remaining = Math.max(0, matched.length - offset - batch.length);
  return {
    language,
    setsProcessed: processed,
    variantsCreated,
    variantsPriced,
    remainingSets: remaining,
    done: remaining === 0,
  };
}
