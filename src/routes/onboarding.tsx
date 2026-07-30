import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { LineChart, ScanLine, Library, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome to Vaultra — Scan, Price, Collect" },
      {
        name: "description",
        content:
          "A quick tour of Vaultra's AI card scanner, complete Pokémon database and multi-source price tracking.",
      },
      { property: "og:title", content: "Welcome to Vaultra" },
      {
        property: "og:description",
        content: "Scan, price and track your trading card collection.",
      },
    ],
  }),
  component: Onboarding,
});

const STEPS = [
  {
    icon: ScanLine,
    title: "Scan any card in a second",
    body: "Point your camera and tap once per card. Auto-scan mode reads a whole stack as you flip through it — English and Japanese printings alike.",
  },
  {
    icon: Library,
    title: "Every card, one database",
    body: "Search all English and Japanese Pokémon cards by name, set or number. Japanese cards always show their official English name.",
  },
  {
    icon: LineChart,
    title: "Prices from every source",
    body: "TCGplayer, eBay sold listings, snkrdunk and PriceCharting overlaid on one graph, with your portfolio value tracked over time.",
  },
];

function Onboarding() {
  const [step, setStep] = useState(0);
  const Icon = STEPS[step].icon;
  const last = step === STEPS.length - 1;

  return (
    <main className="flex min-h-[calc(100vh-6rem)] flex-col justify-between px-6 py-10">
      <div className="pt-10">
        <p className="font-display text-sm font-semibold tracking-[0.3em] text-muted-foreground uppercase">
          Vaultra
        </p>
        <div className="mt-10 grid size-16 place-items-center rounded-2xl bg-primary/15 text-primary shadow-glow">
          <Icon className="size-8" />
        </div>
        <h1 className="mt-6 text-3xl leading-tight font-bold text-balance">
          {STEPS[step].title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {STEPS[step].body}
        </p>
      </div>

      <div className="space-y-5">
        <div className="flex gap-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-surface-2",
              )}
            />
          ))}
        </div>
        {last ? (
          <Link
            to="/"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
          >
            Start collecting <ArrowRight className="size-4" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
          >
            Continue <ArrowRight className="size-4" />
          </button>
        )}
        <Link
          to="/"
          className="block text-center text-xs font-semibold text-muted-foreground"
        >
          Skip
        </Link>
      </div>
    </main>
  );
}
