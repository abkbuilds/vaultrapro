import { cn } from "@/lib/utils";
import type { TimeRange } from "@/lib/tcg/types";

const RANGES: TimeRange[] = ["1D", "1W", "1M", "3M", "1Y", "5Y", "ALL"];

export function RangeToggle({
  value,
  onChange,
  ranges = RANGES,
}: {
  value: TimeRange;
  onChange: (r: TimeRange) => void;
  ranges?: TimeRange[];
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-surface-2/70 p-1">
      {ranges.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={cn(
            "flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors",
            value === r
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
