import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { ReactLenis, useLenis } from "lenis/react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function OverlayScrollLock() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;

    const syncLock = () => {
      const overlayOpen = document.querySelector(
        '[role="dialog"][data-state="open"], [data-vaul-drawer][data-state="open"]',
      );
      if (overlayOpen) lenis.stop();
      else lenis.start();
    };

    const observer = new MutationObserver(syncLock);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });
    syncLock();

    return () => {
      observer.disconnect();
      lenis.start();
    };
  }, [lenis]);

  return null;
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
          ? { offset: -88, immediate: true }
          : { offset: -88, duration: 1.15 },
        duration: reducedMotion ? 0 : 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: !reducedMotion,
        syncTouch: false,
        allowNestedScroll: true,
        stopInertiaOnNavigate: true,
      }}
    >
      <OverlayScrollLock />
      {children}
    </ReactLenis>
  );
}