import { useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ScanLine, Library, TrendingUp, Handshake, User, Search } from "lucide-react";
import { animate, utils } from "animejs";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/database", label: "Search", icon: Search },
  { to: "/collection", label: "Collection", icon: Library },
  { to: "/scan", label: "Scan", icon: ScanLine },
  { to: "/trades", label: "Sales", icon: Handshake },
  { to: "/trends", label: "Trends", icon: TrendingUp },
  { to: "/profile", label: "Profile", icon: User },
] as const;

function reduced() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const listRef = useRef<HTMLUListElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  // Slide a highlight pill under the active tab.
  useEffect(() => {
    const list = listRef.current;
    const pill = pillRef.current;
    if (!list || !pill) return;

    const move = () => {
      const active = list.querySelector<HTMLElement>('[data-active="true"]');
      if (!active) {
        utils.set(pill, { opacity: 0 });
        return;
      }
      const listBox = list.getBoundingClientRect();
      const box = active.getBoundingClientRect();
      const target = {
        width: box.width,
        x: box.left - listBox.left,
        opacity: 1,
      };
      if (reduced() || pill.style.opacity === "" || pill.style.opacity === "0") {
        utils.set(pill, target);
        return;
      }
      animate(pill, { ...target, duration: 420, ease: "outElastic(1, 0.85)" });
    };

    const frame = requestAnimationFrame(move);
    window.addEventListener("resize", move);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", move);
    };
  }, [pathname]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul
        ref={listRef}
        className="relative mx-auto flex max-w-xl items-stretch justify-between px-1"
      >
        <span
          ref={pillRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-1 h-1 rounded-full bg-primary opacity-0"
        />
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          const isScan = to === "/scan";
          return (
            <li key={to} className="flex-1" data-active={active ? "true" : "false"}>
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[9px] font-medium tracking-tight transition-colors duration-300 active:scale-95",
                  "transition-transform will-change-transform",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-xl transition-all duration-300 ease-out",
                    isScan &&
                      "-mt-4 size-11 rounded-2xl bg-primary text-primary-foreground shadow-glow hover:scale-105",
                    !isScan && active && "scale-105 bg-primary/12",
                  )}
                >
                  <Icon className={cn(isScan ? "size-5.5" : "size-4.5")} strokeWidth={2.1} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
