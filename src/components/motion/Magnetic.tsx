import { useEffect, useRef, type ReactNode } from "react";
import { animate, utils } from "animejs";

function reduced() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type Props = {
  children: ReactNode;
  /** How far the element drifts towards the pointer, in px. */
  strength?: number;
  className?: string;
};

/**
 * Wraps an element so it drifts gently towards the pointer and springs back.
 * Pointer-only: touch devices and reduced-motion users get a static element.
 */
export function Magnetic({ children, strength = 10, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced() || !window.matchMedia("(hover: hover)").matches) return;

    const onMove = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const dx = (e.clientX - (box.left + box.width / 2)) / (box.width / 2);
      const dy = (e.clientY - (box.top + box.height / 2)) / (box.height / 2);
      animate(el, {
        x: utils.clamp(dx, -1, 1) * strength,
        y: utils.clamp(dy, -1, 1) * strength,
        duration: 400,
        ease: "outQuad",
      });
    };

    const onLeave = () => {
      animate(el, { x: 0, y: 0, duration: 700, ease: "outElastic(1, 0.5)" });
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      utils.set(el, { x: 0, y: 0 });
    };
  }, [strength]);

  return (
    <span ref={ref} className={className} style={{ display: "contents" }}>
      <span className="block will-change-transform">{children}</span>
    </span>
  );
}
