import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { animate, utils } from "animejs";
import { useLenis } from "lenis/react";

const SELECTOR = [
  "[data-reveal]",
  "main > section",
  "main > header",
  "main > article",
  "main > div > section",
].join(", ");

const REVEALED = "data-revealed";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Global scroll choreography: sections ease in as they enter the viewport,
 * re-armed on every route change. Purely presentational.
 */
export function ScrollAnimator() {
  const location = useRouterState({
    select: (s) => ({ pathname: s.location.pathname, hash: s.location.hash }),
  });
  const lenis = useLenis();
  const restoringHistory = useRef(false);

  useEffect(() => {
    const markHistoryNavigation = () => {
      restoringHistory.current = true;
    };
    window.addEventListener("popstate", markHistoryNavigation);
    return () => window.removeEventListener("popstate", markHistoryNavigation);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    let observer: IntersectionObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let frame = 0;
    let queued: HTMLElement[] = [];
    let flushTimer: number | undefined;

    const flush = () => {
      if (!queued.length) return;
      const batch = queued;
      queued = [];
      batch.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      batch.forEach((el, i) => {
        animate(el, {
          opacity: [0, 1],
          y: [18, 0],
          filter: ["blur(6px)", "blur(0px)"],
          duration: 620,
          delay: i * 70,
          ease: "outQuart",
          onComplete: () => {
            utils.set(el, { filter: "none", transform: "none" });
          },
        });
      });
    };

    const arm = () => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)).filter(
        (el) => !el.hasAttribute(REVEALED),
      );
      if (!nodes.length) return;

      for (const el of nodes) {
        el.setAttribute(REVEALED, "pending");
        utils.set(el, { opacity: 0, y: 18 });
        observer?.observe(el);
      }
    };

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          observer?.unobserve(el);
          el.setAttribute(REVEALED, "true");
          queued.push(el);
        }
        window.clearTimeout(flushTimer);
        flushTimer = window.setTimeout(flush, 16);
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    frame = requestAnimationFrame(arm);

    // Content loaded after fetches should animate in too.
    mutationObserver = new MutationObserver(() => {
      window.clearTimeout(flushTimer);
      flushTimer = window.setTimeout(arm, 60);
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    // Safety net: never leave content hidden.
    const safety = window.setTimeout(() => {
      document
        .querySelectorAll<HTMLElement>(`[${REVEALED}="pending"]`)
        .forEach((el) => utils.set(el, { opacity: 1, y: 0 }));
    }, 2500);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(flushTimer);
      window.clearTimeout(safety);
      observer?.disconnect();
      mutationObserver?.disconnect();
      document.querySelectorAll<HTMLElement>(`[${REVEALED}]`).forEach((el) => {
        el.removeAttribute(REVEALED);
        utils.set(el, { opacity: 1, y: 0, filter: "none" });
      });
    };
  }, [location.pathname]);

  // Cancel carried momentum for new pages while preserving browser back/forward positions.
  useEffect(() => {
    if (restoringHistory.current) {
      restoringHistory.current = false;
      requestAnimationFrame(() => lenis?.resize());
      return;
    }

    const target = location.hash
      ? document.getElementById(location.hash.replace(/^#/, ""))
      : null;
    requestAnimationFrame(() => {
      if (lenis) {
        lenis.resize();
        lenis.scrollTo(target ?? 0, {
          offset: target ? -88 : 0,
          immediate: !target || prefersReducedMotion(),
          force: true,
        });
        return;
      }
      if (target) target.scrollIntoView({ behavior: "auto" });
      else window.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [lenis, location.hash, location.pathname]);

  return null;
}
