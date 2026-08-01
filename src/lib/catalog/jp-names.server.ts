/**
 * English names for Japanese cards that the TCGplayer mirror does not list
 * (older sets, regional promos). Uses PokéAPI — a free, keyless, open source
 * API — for the official Japanese→English Pokémon species mapping, plus a
 * small table for common Japanese trainer/energy wording.
 *
 * Only real, sourced translations are written; anything we cannot map is left
 * untouched rather than guessed.
 */

interface SpeciesName {
  name: string;
  language: { name: string };
}

const TERMS: [RegExp, string][] = [
  [/^ポケモンだいすきクラブ$/, "Pokémon Fan Club"],
  [/^モンスターボール$/, "Poké Ball"],
  [/^スーパーボール$/, "Great Ball"],
  [/^ハイパーボール$/, "Ultra Ball"],
  [/^きずぐすり$/, "Potion"],
  [/^すごいきずぐすり$/, "Super Potion"],
  [/^げんきのかけら$/, "Revive"],
  [/^博士の研究$/, "Professor's Research"],
  [/^ポケモン通信$/, "Pokémon Communication"],
  [/^エネルギー$/, "Energy"],
  [/^基本(.+)エネルギー$/, "Basic $1 Energy"],
];

const ENERGY_TYPES: Record<string, string> = {
  草: "Grass",
  炎: "Fire",
  水: "Water",
  雷: "Lightning",
  超: "Psychic",
  闘: "Fighting",
  悪: "Darkness",
  鋼: "Metal",
  無色: "Colorless",
  フェアリー: "Fairy",
  ドラゴン: "Dragon",
};

/** Suffixes that are already latin or numeric and should be preserved. */
const SUFFIX = /([\s]?(?:ex|EX|GX|V|VMAX|VSTAR|V-UNION|LV\.X|BREAK|δ|★|Prime)\s*)+$/;

async function buildSpeciesMap(): Promise<Map<string, string>> {
  const list = (await (
    await fetch("https://pokeapi.co/api/v2/pokemon-species?limit=1200", {
      headers: { accept: "application/json", "user-agent": "curl/8.7.1" },
    })
  ).json()) as { results: { name: string; url: string }[] };

  const map = new Map<string, string>();
  const queue = [...list.results];
  const workers = Array.from({ length: 16 }, async () => {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      try {
        const res = await fetch(item.url, {
          headers: { accept: "application/json", "user-agent": "curl/8.7.1" },
        });
        if (!res.ok) continue;
        const data = (await res.json()) as { names: SpeciesName[] };
        const en = data.names.find((n) => n.language.name === "en")?.name;
        if (!en) continue;
        for (const n of data.names) {
          if (n.language.name === "ja" || n.language.name === "ja-Hrkt") {
            map.set(n.name, en);
          }
        }
      } catch {
        /* skip unreachable species */
      }
    }
  });
  await Promise.all(workers);
  return map;
}

export function translateName(raw: string, species: Map<string, string>): string | null {
  const name = raw.trim();

  for (const [re, out] of TERMS) {
    const m = name.match(re);
    if (m) {
      const replaced = out.replace("$1", ENERGY_TYPES[m[1] ?? ""] ?? m[1] ?? "");
      return replaced.trim();
    }
  }

  const suffix = name.match(SUFFIX)?.[0] ?? "";
  const base = suffix ? name.slice(0, name.length - suffix.length) : name;

  // "Trainer's Pokémon" style prefixes, e.g. "サカキのニドキング".
  const owner = base.match(/^(.+?)の(.+)$/);
  const core = owner ? owner[2] : base;
  const en = species.get(core);
  if (!en) return null;

  const ownerEn = owner ? species.get(owner[1]) : null;
  const prefix = owner ? `${ownerEn ?? owner[1]}'s ` : "";
  return `${prefix}${en}${suffix ? ` ${suffix.trim()}` : ""}`.trim();
}

export interface JpNameResult {
  candidates: number;
  translated: number;
  remaining: number;
  done: boolean;
}

export async function runJpNameSync(opts: { limit?: number }): Promise<JpNameResult> {
  const maxPages = Math.max(1, Math.ceil((opts.limit ?? 5000) / 1000));
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const species = await buildSpeciesMap();

  let candidates = 0;
  let translated = 0;
  // Untranslatable rows stay NULL, so page through with an offset rather than
  // re-reading the same first page every call.
  let offset = 0;
  for (let page = 0; page < maxPages; page++) {
    const { data, error } = await supabaseAdmin
      .from("tcg_cards")
      .select("id,name")
      .eq("language", "JP")
      .is("english_name", null)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { id: string; name: string }[];
    if (!rows.length) break;
    candidates += rows.length;

    const updates = rows
      .map((r) => ({ id: r.id, english_name: translateName(r.name, species) }))
      .filter((u): u is { id: string; english_name: string } => Boolean(u.english_name));

    for (let i = 0; i < updates.length; i += 200) {
      await Promise.all(
        updates
          .slice(i, i + 200)
          .map((c) =>
            supabaseAdmin
              .from("tcg_cards")
              .update({ english_name: c.english_name })
              .eq("id", c.id),
          ),
      );
    }
    translated += updates.length;
    // Rows we could not translate remain in the result set, so skip past them.
    offset += rows.length - updates.length;
    if (rows.length < 1000) break;
  }

  const { count } = await supabaseAdmin
    .from("tcg_cards")
    .select("id", { count: "exact", head: true })
    .eq("language", "JP")
    .is("english_name", null);

  return {
    candidates,
    translated,
    remaining: count ?? 0,
    done: translated === 0,
  };
}
