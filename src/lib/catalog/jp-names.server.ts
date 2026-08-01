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

/** Suffixes that are already latin/наumeric and should be preserved. */
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
  const limit = opts.limit ?? 1500;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error, count } = await supabaseAdmin
    .from("tcg_cards")
    .select("id,name", { count: "exact" })
    .eq("language", "JP")
    .is("english_name", null)
    .limit(Math.min(limit, 1000));
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; name: string }[];
  if (!rows.length) return { candidates: 0, translated: 0, remaining: 0, done: true };

  const species = await buildSpeciesMap();

  let translated = 0;
  const chunk: { id: string; english_name: string }[] = [];
  for (const row of rows) {
    const en = translateName(row.name, species);
    if (en) chunk.push({ id: row.id, english_name: en });
  }

  for (let i = 0; i < chunk.length; i += 200) {
    await Promise.all(
      chunk.slice(i, i + 200).map((c) =>
        supabaseAdmin
          .from("tcg_cards")
          .update({ english_name: c.english_name })
          .eq("id", c.id),
      ),
    );
    translated += Math.min(200, chunk.length - i);
  }

  const remaining = Math.max(0, (count ?? rows.length) - translated);
  return {
    candidates: rows.length,
    translated,
    remaining,
    done: translated === 0 || remaining === 0,
  };
}
