import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CARDS } from "@/lib/tcg/cards";
import { CardTile, PageHeader } from "@/components/tcg/CardBits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/database")({
  head: () => ({
    meta: [
      { title: "Card Database — Vaultra" },
      {
        name: "description",
        content:
          "Browse English and Japanese Pokémon TCG cards with set, rarity and type filters plus live market prices.",
      },
      { property: "og:title", content: "Card Database — Vaultra" },
      {
        property: "og:description",
        content: "Search every English and Japanese Pokémon card with pricing.",
      },
    ],
  }),
  component: DatabasePage,
});

function DatabasePage() {
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<"all" | "EN" | "JP">("all");
  const [set, setSet] = useState("all");
  const [rarity, setRarity] = useState("all");

  const sets = useMemo(() => [...new Set(CARDS.map((c) => c.setName))].sort(), []);
  const rarities = useMemo(() => [...new Set(CARDS.map((c) => c.rarity))].sort(), []);

  const results = CARDS.filter((c) => {
    const text = `${c.name} ${c.nativeName ?? ""} ${c.setName} ${c.setCode} ${c.number}`;
    return (
      (!q || text.toLowerCase().includes(q.toLowerCase())) &&
      (lang === "all" || c.language === lang) &&
      (set === "all" || c.setName === set) &&
      (rarity === "all" || c.rarity === rarity)
    );
  });

  return (
    <main>
      <PageHeader title="Database" subtitle={`${results.length} cards`} />

      <div className="space-y-3 px-4">
        <label className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, set or number (e.g. SV4P 025)"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>

        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {(["all", "EN", "JP"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                lang === l
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2 text-muted-foreground",
              )}
            >
              {l === "all" ? "All languages" : l === "EN" ? "English" : "Japanese"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={set}
            onChange={(e) => setSet(e.target.value)}
            className="rounded-xl bg-surface px-3 py-2.5 text-xs font-medium outline-none"
          >
            <option value="all">All sets</option>
            {sets.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={rarity}
            onChange={(e) => setRarity(e.target.value)}
            className="rounded-xl bg-surface px-3 py-2.5 text-xs font-medium outline-none"
          >
            <option value="all">All rarities</option>
            {rarities.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 px-4">
        {results.map((c) => (
          <CardTile key={c.id} card={c} sub={c.rarity} />
        ))}
        {results.length === 0 && (
          <p className="col-span-2 py-10 text-center text-sm text-muted-foreground">
            Nothing found. Try a different set or spelling.
          </p>
        )}
      </section>
    </main>
  );
}
