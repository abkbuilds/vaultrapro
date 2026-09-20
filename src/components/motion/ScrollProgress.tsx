import { useEffect, useRef } from "react";
import { useLenis } from "lenis/react";

/** Thin progress bar that tracks page scroll, eased for a polished feel. */
export function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);

  useLenis((lenis) => {
    const el = bar.current;
    if (!el) return;
    const progress = Math.max(0, Math.min(1, lenis.progress));
    el.style.transform = `scaleX(${progress})`;
    el.style.opacity = progress > 0.01 ? "1" : "0";
  });

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    el.style.transform = "scaleX(0)";
    el.style.opacity = "0";
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5">
      <div
        ref={bar}
        className="h-full origin-left bg-linear-to-r from-primary to-accent opacity-0 will-change-transform"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
