import type { GameId } from "@/lib/tcg/types";
import { cn } from "@/lib/utils";

/**
 * Wordmark badges for each trading card game shown in the price index.
 * Rendered as styled monograms so no third-party trademark asset is hotlinked.
 */
const BRAND: Record<GameId, { short: string; from: string; to: string; fg: string }> = {
  pokemon: { short: "PKM", from: "#FFCB05", to: "#E3A008", fg: "#1B2A6B" },
  magic: { short: "MTG", from: "#F4A24C", to: "#B4571C", fg: "#1A0F06" },
  onepiece: { short: "OP", from: "#E23C3C", to: "#8E1414", fg: "#FFF6E5" },
  lorcana: { short: "LOR", from: "#7BD4E8", to: "#2E6FA8", fg: "#06202F" },
  yugioh: { short: "YGO", from: "#B08CE8", to: "#5B2E9E", fg: "#F6F0FF" },
};

export function TcgLogo({ game, className }: { game: GameId; className?: string }) {
  const b = BRAND[game];
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-xl text-[10px] font-black tracking-tight",
        className,
      )}
      style={{
        background: `linear-gradient(140deg, ${b.from}, ${b.to})`,
        color: b.fg,
      }}
    >
      {b.short}
    </span>
  );
}
