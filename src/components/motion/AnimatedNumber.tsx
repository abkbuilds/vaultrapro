import { useEffect, useRef } from "react";
import { animate } from "animejs";

type Props = {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
};

function reduced() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Counts smoothly from the previous value to the new one.
 * Only ever displays the real value it is given — no rounding tricks.
 */
export function AnimatedNumber({
  value,
  format = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 2 }),
  duration = 700,
  className,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prev.current;
    prev.current = value;

    if (reduced() || from === value) {
      el.textContent = format(value);
      return;
    }

    const state = { n: from };
    const anim = animate(state, {
      n: value,
      duration,
      ease: "outExpo",
      onUpdate: () => {
        el.textContent = format(state.n);
      },
      onComplete: () => {
        el.textContent = format(value);
      },
    });
    return () => {
      anim.pause();
    };
  }, [value, duration, format]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
