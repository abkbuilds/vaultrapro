import { useEffect, useRef, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { animate, utils } from "animejs";

function reduced() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Cross-fades page content on every route change. Presentational only. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced()) {
      utils.set(el, { opacity: 1, y: 0 });
      return;
    }
    const anim = animate(el, {
      opacity: [0, 1],
      y: [10, 0],
      scale: [0.995, 1],
      duration: 420,
      ease: "outQuart",
      onComplete: () => utils.set(el, { transform: "none" }),
    });
    return () => {
      anim.pause();
      utils.set(el, { opacity: 1, transform: "none" });
    };
  }, [pathname]);

  return <div ref={ref}>{children}</div>;
}
