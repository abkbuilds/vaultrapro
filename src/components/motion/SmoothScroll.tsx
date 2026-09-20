import { useSyncExternalStore, type ReactNode } from "react";
import { ReactLenis } from "lenis/react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** One shared scroll engine, with native touch and reduced-motion behavior preserved. */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );

  return (
    <ReactLenis
      root
      options={{
        autoRaf: true,
        anchors: reducedMotion
          ? { offset: -72, immediate: true }
          : { offset: -72, duration: 1.05 },
        duration: reducedMotion ? 0 : 1.05,
        smoothWheel: !reducedMotion,
        syncTouch: false,
        allowNestedScroll: true,
        stopInertiaOnNavigate: true,
      }}
    >
      {children}
    </ReactLenis>
  );
}