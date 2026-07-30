import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ScanLine, Library, Search, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/collection", label: "Collection", icon: Library },
  { to: "/scan", label: "Scan", icon: ScanLine },
  { to: "/database", label: "Browse", icon: Search },
  { to: "/trends", label: "Trends", icon: TrendingUp },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          const isScan = to === "/scan";
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium tracking-wide transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-xl transition-all",
                    isScan &&
                      "-mt-4 size-12 rounded-2xl bg-primary text-primary-foreground shadow-glow",
                    !isScan && active && "bg-primary/12",
                  )}
                >
                  <Icon className={cn(isScan ? "size-6" : "size-5")} strokeWidth={2.1} />
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
