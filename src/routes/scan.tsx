import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Heart, RefreshCw, Zap, X } from "lucide-react";
import { toast } from "sonner";
import { CARDS } from "@/lib/tcg/cards";
import { CONDITIONS, type Condition, type TcgCard } from "@/lib/tcg/types";
import { useCollection } from "@/lib/tcg/collection";
import { CardImage, money } from "@/components/tcg/CardBits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "AI Card Scanner — Vaultra" },
      {
        name: "description",
        content:
          "Point, tap, done. Vaultra's AI scanner identifies English and Japanese Pokémon cards and adds them to your collection.",
      },
      { property: "og:title", content: "AI Card Scanner — Vaultra" },
      {
        property: "og:description",
        content: "Bulk-scan Pokémon cards and price them instantly.",
      },
    ],
  }),
  component: ScanPage,
});

/** Mock recognition service — swap for a real vision endpoint later. */
function recognize(seed: number): { match: TcgCard; alternates: TcgCard[] } {
  const match = CARDS[seed % CARDS.length];
  const alternates = CARDS.filter(
    (c) => c.id !== match.id && c.language === match.language,
  ).slice(0, 3);
  return { match, alternates };
}

function ScanPage() {
  const { add, toggleWishlist } = useCollection();
  const [auto, setAuto] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ match: TcgCard; alternates: TcgCard[] } | null>(
    null,
  );
  const [condition, setCondition] = useState<Condition>("Near Mint");
  const [recent, setRecent] = useState<TcgCard[]>([]);
  const counter = useRef(0);

  function doScan() {
    if (scanning) return;
    setScanning(true);
    setTimeout(() => {
      const r = recognize(counter.current++ + Date.now() % 7);
      setResult(r);
      setRecent((p) => [r.match, ...p].slice(0, 10));
      setScanning(false);
    }, 700);
  }

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(doScan, 2600);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, scanning]);

  const card = result?.match;

  return (
    <main className="relative min-h-[calc(100vh-6rem)]">
      {/* Camera viewfinder */}
      <div className="relative h-[62vh] overflow-hidden bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,oklch(0.3_0.05_275),oklch(0.11_0.02_275))]" />
        <div className="absolute inset-0 grid place-items-center">
          <div className="relative aspect-[63/88] w-[58%] rounded-2xl border-2 border-primary/70 shadow-glow">
            <span className="absolute -inset-px rounded-2xl ring-1 ring-white/10" />
            {scanning && (
              <span className="absolute inset-x-0 top-0 h-1 animate-bounce rounded-full bg-primary" />
            )}
          </div>
        </div>

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold backdrop-blur">
            {scanning ? "Identifying…" : "Line up a card"}
          </span>
          <button
            type="button"
            onClick={() => setAuto((a) => !a)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur transition-colors",
              auto ? "bg-primary text-primary-foreground" : "bg-black/50 text-foreground",
            )}
          >
            <Zap className="size-3.5" /> Auto-scan {auto ? "on" : "off"}
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 space-y-3 p-4">
          {recent.length > 0 && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {recent.map((c, i) => (
                <Link
                  key={`${c.id}-${i}`}
                  to="/card/$cardId"
                  params={{ cardId: c.id }}
                  className="w-10 shrink-0"
                >
                  <CardImage card={c} className="rounded-md" />
                </Link>
              ))}
            </div>
          )}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={doScan}
              aria-label="Capture card"
              className="grid size-18 place-items-center rounded-full bg-white/90 ring-4 ring-white/30 transition-transform active:scale-95"
            >
              <span className="size-14 rounded-full bg-primary" />
            </button>
          </div>
        </div>
      </div>

      {/* Result sheet */}
      <section className="px-4 pt-4">
        {!card ? (
          <p className="pt-6 text-center text-sm text-muted-foreground">
            Tap the shutter to scan. Turn on auto-scan to capture cards as you flip
            through a stack.
          </p>
        ) : (
          <div className="glass-panel rounded-3xl p-4">
            <div className="flex gap-3">
              <CardImage card={card} className="w-20 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold">{card.name}</p>
                    {card.nativeName && (
                      <p className="truncate text-xs text-muted-foreground">
                        {card.nativeName}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    aria-label="Dismiss scan result"
                    className="text-muted-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {card.setName} · {card.setCode} — {card.number} · {card.language}
                </p>
                <p className="mt-1 text-sm font-bold tabular-nums">
                  {money(card.marketPrice)}
                </p>
              </div>
            </div>

            <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    condition === c
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-2 text-muted-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>

            {result.alternates.length > 0 && (
              <div className="mt-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <RefreshCw className="size-3.5" /> Not this printing? Try a variant
                </p>
                <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
                  {result.alternates.map((alt) => (
                    <button
                      key={alt.id}
                      type="button"
                      onClick={() =>
                        setResult({
                          match: alt,
                          alternates: [card, ...result.alternates.filter((a) => a.id !== alt.id)],
                        })
                      }
                      className="w-14 shrink-0"
                    >
                      <CardImage card={alt} className="rounded-md" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  add(card.id, condition);
                  toast.success(`${card.name} added to collection`);
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground active:opacity-90"
              >
                <Check className="size-4" /> Add to collection
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleWishlist(card.id);
                  toast(`${card.name} wishlist updated`);
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-surface-2 py-3 text-sm font-semibold active:opacity-90"
              >
                <Heart className="size-4" /> Wishlist
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
