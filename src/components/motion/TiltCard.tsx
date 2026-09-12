import { useEffect, useRef, type ReactNode } from "react";
import { animate, utils } from "animejs";
import { cn } from "@/lib/utils";

function reduced() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Subtle 3D tilt that follows the pointer and eases back on leave. */
export function TiltCard({
  children,
  className,
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced() || !window.matchMedia("(hover: hover)").matches) return;

    const onMove = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const px = (e.clientX - box.left) / box.width - 0.5;
      const py = (e.clientY - box.top) / box.height - 0.5;
      animate(el, {
        rotateY: px * max * 2,
        rotateX: -py * max * 2,
        scale: 1.015,
        duration: 350,
        ease: "outQuad",
      });
    };

    const onLeave = () => {
      animate(el, {
        rotateX: 0,
        rotateY: 0,
        scale: 1,
        duration: 650,
        ease: "outElastic(1, 0.6)",
      });
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      utils.set(el, { rotateX: 0, rotateY: 0, scale: 1 });
    };
  }, [max]);

  return (
    <div
      ref={ref}
      className={cn("will-change-transform", className)}
      style={{ transformStyle: "preserve-3d", perspective: 800 }}
    >
      {children}
    </div>
  );
}
