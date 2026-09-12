import { useEffect, useRef, type ReactNode } from "react";
import { animate, stagger, utils } from "animejs";
import { cn } from "@/lib/utils";

function reduced() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type Props = {
  /** Plain text to animate word-by-word. */
  text: string;
  className?: string;
  /** Rendered after the animated text (e.g. a highlighted span). */
  children?: ReactNode;
  delay?: number;
};

/**
 * Reveals a headline word by word. Purely presentational —
 * the full text stays in the DOM for screen readers and SEO.
 */
export function SplitText({ text, className, children, delay = 0 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const words = Array.from(root.querySelectorAll<HTMLElement>("[data-word]"));
    if (!words.length) return;

    if (reduced()) {
      utils.set(words, { opacity: 1, y: 0, filter: "none" });
      return;
    }

    utils.set(words, { opacity: 0, y: 18 });
    const anim = animate(words, {
      opacity: [0, 1],
      y: [18, 0],
      filter: ["blur(8px)", "blur(0px)"],
      duration: 760,
      delay: stagger(48, { start: delay }),
      ease: "outExpo",
      onComplete: () => utils.set(words, { filter: "none", transform: "none" }),
    });

    return () => {
      anim.pause();
      utils.set(words, { opacity: 1, filter: "none", transform: "none" });
    };
  }, [text, delay]);

  return (
    <span ref={ref} className={cn("inline", className)}>
      {text.split(" ").map((word, i) => (
        <span
          key={`${word}-${i}`}
          data-word
          className="inline-block will-change-transform"
          style={{ whiteSpace: "pre" }}
        >
          {word}{" "}
        </span>
      ))}
      {children}
    </span>
  );
}
