import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ScanLine, Library, TrendingUp, Handshake, User, Search } from "lucide-react";
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


export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="mx-auto flex max-w-xl items-stretch justify-between px-1">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          const isScan = to === "/scan";
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[9px] font-medium tracking-tight transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-xl transition-all",
                    isScan &&
                      "-mt-4 size-11 rounded-2xl bg-primary text-primary-foreground shadow-glow",
                    !isScan && active && "bg-primary/12",
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
