import { useEffect, useRef } from "react";
import { animate } from "animejs";

/** Thin progress bar that tracks page scroll, eased for a polished feel. */
export function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    let raf = 0;

    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      animate(el, {
        scaleX: progress,
        opacity: progress > 0.01 ? 1 : 0,
        duration: 320,
        ease: "outQuad",
      });
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5">
      <div
        ref={bar}
        className="h-full origin-left bg-linear-to-r from-primary to-accent opacity-0"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
