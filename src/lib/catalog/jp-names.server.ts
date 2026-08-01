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
          if (n.language.name === "ja" || n.language.name === "ja-Hrkt" || n.language.name === "roomaji") {
            map.set(n.name.normalize("NFKC").replace(/\s+/g, ""), en);
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

function titleCase(s: string) {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}


/** Minimal katakana → romaji table for matching transliterated English names. */
const KANA: Record<string, string> = {
  ア:"a",イ:"i",ウ:"u",エ:"e",オ:"o",カ:"ka",キ:"ki",ク:"ku",ケ:"ke",コ:"ko",
  サ:"sa",シ:"shi",ス:"su",セ:"se",ソ:"so",タ:"ta",チ:"chi",ツ:"tsu",テ:"te",ト:"to",
  ナ:"na",ニ:"ni",ヌ:"nu",ネ:"ne",ノ:"no",ハ:"ha",ヒ:"hi",フ:"fu",ヘ:"he",ホ:"ho",
  マ:"ma",ミ:"mi",ム:"mu",メ:"me",モ:"mo",ヤ:"ya",ユ:"yu",ヨ:"yo",
  ラ:"ra",リ:"ri",ル:"ru",レ:"re",ロ:"ro",ワ:"wa",ヲ:"o",ン:"n",
  ガ:"ga",ギ:"gi",グ:"gu",ゲ:"ge",ゴ:"go",ザ:"za",ジ:"ji",ズ:"zu",ゼ:"ze",ゾ:"zo",
  ダ:"da",ヂ:"ji",ヅ:"zu",デ:"de",ド:"do",バ:"ba",ビ:"bi",ブ:"bu",ベ:"be",ボ:"bo",
  パ:"pa",ピ:"pi",プ:"pu",ペ:"pe",ポ:"po",ヴ:"vu",
};
const SMALL: Record<string, string> = { ャ:"ya", ュ:"yu", ョ:"yo", ァ:"a", ィ:"i", ゥ:"u", ェ:"e", ォ:"o" };

function romaji(kana: string): string {
  let out = "";
  const chars = [...kana];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    if (c === "ー") continue;
    if (c === "ッ") continue;
    const small = SMALL[chars[i + 1] ?? ""];
    const base = KANA[c];
    if (!base) { out += c.toLowerCase(); continue; }
    if (small) {
      out += base.replace(/(sh|ch|j)?[aiueo]$/, (m, d) => (d ? d + small.slice(-1) : base[0] + small));
      i++;
    } else {
      out += base;
    }
  }
  return out;
}

/** Collapse spelling noise so transliterations compare cleanly. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/l/g, "r")
    .replace(/([bcdfghjkmnpqrstvwxyz])u(?![aiueo])/g, "$1")
    .replace(/(.)\1+/g, "$1");
}

function distance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

let englishIndex: [string, string][] | null = null;
function buildEnglishIndex(species: Map<string, string>): [string, string][] {
  if (englishIndex) return englishIndex;
  const seen = new Set<string>();
  englishIndex = [];
  for (const en of species.values()) {
    if (seen.has(en)) continue;
    seen.add(en);
    englishIndex.push([fold(en), en]);
  }
  return englishIndex;
}

/** Matches machine-transliterated katakana (e.g. マグネトン) to "Magneton". */
function matchTransliteration(core: string, species: Map<string, string>): string | null {
  if (!/^[ァ-ヴー・]+$/.test(core)) return null;
  const target = fold(romaji(core));
  if (target.length < 4) return null;
  let best: { name: string; d: number } | null = null;
  for (const [folded, en] of buildEnglishIndex(species)) {
    const d = distance(target, folded);
    if (!best || d < best.d) best = { name: en, d };
    if (d === 0) break;
  }
  const tolerance = target.length >= 8 ? 2 : 1;
  return best && best.d <= tolerance ? best.name : null;
}

export function translateName(raw: string, species: Map<string, string>): string | null {
  const name = raw.normalize("NFKC").replace(/\s+/g, " ").trim();

  // Some upstream records already carry a latin name (with inconsistent case).
  if (/^[\x20-\x7E]+$/.test(name)) return titleCase(name);

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
  const key = core.normalize("NFKC").replace(/\s+/g, "");
  const en = species.get(key) ?? matchTransliteration(core, species);
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
