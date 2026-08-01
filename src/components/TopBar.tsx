import { Link, useRouterState } from "@tanstack/react-router";
import { Search, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth";

/**
 * Global top bar. Always exposes the card database and, on the right,
 * either a prominent Sign up / Sign in button or the signed-in account chip.
 */
export function TopBar() {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const initial = (
    (user?.user_metadata?.["display_name"] as string | undefined) ??
    user?.email ??
    "?"
  )
    .charAt(0)
    .toUpperCase();

  if (pathname === "/auth" || pathname.startsWith("/reset-password")) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-2.5">
        <Link to="/" className="font-display text-base font-bold tracking-tight">
          Vaultra
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/database"
            aria-label="Search the card database"
            className="grid size-9 place-items-center rounded-xl bg-surface text-muted-foreground transition-colors hover:text-foreground"
          >
            <Search className="size-4.5" strokeWidth={2.1} />
          </Link>

          {loading ? (
            <span className="size-9 animate-pulse rounded-xl bg-surface" />
          ) : user ? (
            <Link
              to="/profile"
              aria-label="Your profile"
              className="grid size-9 place-items-center rounded-xl bg-primary/15 text-sm font-bold text-primary"
            >
              {initial}
            </Link>
          ) : (
            <Link
              to="/auth"
              search={{ redirect: pathname }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-glow"
            >
              <LogIn className="size-4" strokeWidth={2.3} />
              Sign up / Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
