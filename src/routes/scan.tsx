import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Check, Heart, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { identifyCard } from "@/lib/scan/scan.functions";
import { searchCards } from "@/lib/catalog/queries";
import { CONDITIONS, type Condition, type TcgCard } from "@/lib/tcg/types";
import { useCollection } from "@/lib/tcg/collection";
import { CardImage, Price } from "@/components/tcg/CardBits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "AI Card Scanner — Vaultra" },
      {
        name: "description",
        content:
          "Point your camera at a card and Vaultra's AI reads the name, set code and number off the print to match it against the real catalogue.",
      },
      { property: "og:title", content: "AI Card Scanner — Vaultra" },
      {
        property: "og:description",
        content: "Scan English and Japanese Pokémon cards with your camera and price them instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScanPage,
});

function looseNumber(n: string | null | undefined) {
  if (!n) return "";
  const m = n.trim().toUpperCase().match(/^([A-Z]*)0*(\d+)([A-Z]*)$/);
  return m ? `${m[1]}${m[2]}${m[3]}` : n.trim().toUpperCase();
}

interface Identified {
  name: string | null;
  number: string | null;
  setCode: string | null;
  language: "EN" | "JP" | null;
  confidence: number;
}

/** Finds the real catalogue printings that match what the AI read off the card. */
async function matchCatalogue(read: Identified): Promise<TcgCard[]> {
  if (!read.name) return [];
  const attempts: string[] = [];
  if (read.number) attempts.push(`${read.name} ${read.number}`);
  attempts.push(read.name);

  for (const query of attempts) {
    const { cards } = await searchCards({
      query,
      language: read.language ?? "all",
      pageSize: 40,
    });
    if (!cards.length) continue;
    const num = looseNumber(read.number);
    const code = read.setCode?.toUpperCase();
    const scored = [...cards].sort((a, b) => score(b) - score(a));
    function score(c: TcgCard) {
      let s = 0;
      if (num && looseNumber(c.number) === num) s += 4;
      if (code && c.setCode.toUpperCase() === code) s += 3;
      if (c.name.toLowerCase() === read.name!.toLowerCase()) s += 2;
      if (c.image) s += 1;
      return s;
    }
    return scored.slice(0, 8);
  }
  return [];
}

function ScanPage() {
  const { add, toggleWishlist } = useCollection();
  const identify = useServerFn(identifyCard);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [camera, setCamera] = useState<"idle" | "starting" | "live" | "denied" | "unsupported">(
    "idle",
  );
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState<Identified | null>(null);
  const [matches, setMatches] = useState<TcgCard[]>([]);
  const [picked, setPicked] = useState<TcgCard | null>(null);
  const [condition, setCondition] = useState<Condition>("Near Mint");
  const [recent, setRecent] = useState<TcgCard[]>([]);

  const startCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCamera("unsupported");
      return;
    }
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCamera("live");
    } catch {
      setCamera("denied");
    }
  }, []);

  // Ask for camera access as soon as the Scan tab opens.
  useEffect(() => {
    void startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [startCamera]);

  async function capture() {
    const video = videoRef.current;
    if (busy) return;
    if (!video || camera !== "live" || !video.videoWidth) {
      toast.error("Camera isn't ready yet");
      return;
    }
    setBusy(true);
    try {
      // Crop the centre frame (the card guide) for a cleaner read.
      const cw = Math.round(video.videoWidth * 0.72);
      const ch = Math.min(video.videoHeight, Math.round(cw * (88 / 63)));
      const sx = Math.round((video.videoWidth - cw) / 2);
      const sy = Math.round((video.videoHeight - ch) / 2);
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(cw, 1000);
      canvas.height = Math.round((canvas.width * ch) / cw);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Capture failed");
      ctx.drawImage(video, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.82);

      const result = await identify({ data: { image } });
      if (!result.name) {
        toast.error("No readable card in frame — line it up and try again");
        setRead(null);
        setMatches([]);
        setPicked(null);
        return;
      }
      setRead(result);
      const found = await matchCatalogue(result);
      setMatches(found);
      setPicked(found[0] ?? null);
      if (found[0]) setRecent((p) => [found[0], ...p.filter((c) => c.id !== found[0].id)].slice(0, 10));
      if (!found.length) toast.message(`Read "${result.name}" but no catalogue match`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-[calc(100vh-6rem)]">
      <div className="relative h-[62vh] overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={cn(
            "size-full object-cover transition-opacity",
            camera === "live" ? "opacity-100" : "opacity-0",
          )}
        />

        {camera !== "live" && (
          <div className="absolute inset-0 grid place-items-center px-8 text-center">
            {camera === "starting" ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Requesting camera access…
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {camera === "unsupported"
                    ? "This browser can't open a camera. Try Safari or Chrome on your phone."
                    : "Camera access is blocked. Allow it in your browser settings, then retry."}
                </p>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  <Camera className="size-4" /> Enable camera
                </button>
              </div>
            )}
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative aspect-[63/88] w-[58%] rounded-2xl border-2 border-primary/70 shadow-glow">
            <span className="absolute -inset-px rounded-2xl ring-1 ring-white/10" />
            {busy && (
              <span className="absolute inset-x-0 top-0 h-1 animate-bounce rounded-full bg-primary" />
            )}
          </div>
        </div>

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold backdrop-blur">
            {busy ? "Reading the card…" : "Line up a card, then tap"}
          </span>
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
              onClick={() => void capture()}
              disabled={busy || camera !== "live"}
              aria-label="Capture card"
              className="grid size-18 place-items-center rounded-full bg-white/90 ring-4 ring-white/30 transition-transform active:scale-95 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="size-8 animate-spin text-primary" />
              ) : (
                <span className="size-14 rounded-full bg-primary" />
              )}
            </button>
          </div>
        </div>
      </div>

      <section className="px-4 pt-4">
        {!read ? (
          <p className="pt-6 text-center text-sm text-muted-foreground">
            Hold the card flat inside the frame and tap the shutter. The scanner reads the
            printed name, set code and number, then matches it against the live catalogue.
          </p>
        ) : (
          <div className="glass-panel rounded-3xl p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Read from card:{" "}
                <span className="font-semibold text-foreground">{read.name}</span>
                {read.number ? ` · ${read.number}` : ""}
                {read.setCode ? ` · ${read.setCode}` : ""} ·{" "}
                {Math.round(read.confidence * 100)}% confidence
              </p>
              <button
                type="button"
                onClick={() => {
                  setRead(null);
                  setMatches([]);
                  setPicked(null);
                }}
                aria-label="Dismiss scan result"
                className="text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {picked ? (
              <>
                <div className="mt-3 flex gap-3">
                  <CardImage card={picked} className="w-20 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-bold">{picked.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {picked.setName} · {picked.setCode} — {picked.number} · {picked.language}
                    </p>
                    <p className="mt-1 text-sm font-bold">
                      <Price value={picked.marketPrice} />
                    </p>
                    <Link
                      to="/card/$cardId"
                      params={{ cardId: picked.id }}
                      className="mt-1 inline-block text-xs font-semibold text-primary"
                    >
                      View prices
                    </Link>
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

                {matches.length > 1 && (
                  <div className="mt-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <RefreshCw className="size-3.5" /> Different printing? Pick another match
                    </p>
                    <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
                      {matches.map((alt) => (
                        <button
                          key={alt.id}
                          type="button"
                          onClick={() => setPicked(alt)}
                          className={cn(
                            "w-14 shrink-0 rounded-md",
                            alt.id === picked.id && "ring-2 ring-primary",
                          )}
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
                      add(picked.id, condition);
                      toast.success(`${picked.name} added to collection`);
                    }}
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground active:opacity-90"
                  >
                    <Check className="size-4" /> Add to collection
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toggleWishlist(picked.id);
                      toast(`${picked.name} wishlist updated`);
                    }}
                    className="flex items-center justify-center gap-2 rounded-xl bg-surface-2 py-3 text-sm font-semibold active:opacity-90"
                  >
                    <Heart className="size-4" /> Wishlist
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No catalogue printing matched this read. Try again with better lighting, or
                search the database manually.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
