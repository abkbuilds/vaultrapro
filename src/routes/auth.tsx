import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Vaultra" },
      {
        name: "description",
        content:
          "Create a Vaultra account or sign in with Google or Apple to sync your Pokémon card collection, portfolio and trade log across devices.",
      },
      { property: "og:title", content: "Sign in — Vaultra" },
      {
        property: "og:description",
        content: "Sync your collection, portfolio and sales log across every device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4.5" fill="currentColor" aria-hidden>
      <path d="M16.36 12.75c-.02-2.16 1.76-3.2 1.84-3.25-1-1.47-2.57-1.67-3.13-1.69-1.33-.13-2.6.78-3.28.78-.67 0-1.72-.76-2.83-.74-1.45.02-2.79.84-3.54 2.14-1.51 2.62-.39 6.5 1.09 8.63.72 1.04 1.58 2.21 2.71 2.17 1.09-.04 1.5-.7 2.82-.7 1.31 0 1.69.7 2.84.68 1.17-.02 1.91-1.06 2.63-2.1.83-1.2 1.17-2.37 1.19-2.43-.03-.01-2.29-.88-2.31-3.49zM14.2 5.4c.6-.73 1-1.74.89-2.75-.86.03-1.9.57-2.52 1.29-.55.64-1.04 1.67-.91 2.65.96.08 1.94-.49 2.54-1.19z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.5 5.5 0 0 1-2.39 3.6v3h3.86c2.26-2.08 3.58-5.15 3.58-8.79z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.87-3a7.2 7.2 0 0 1-10.72-3.78H1.36v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.36 14.31a7.2 7.2 0 0 1 0-4.6V6.6H1.36a12 12 0 0 0 0 10.8l4-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.36 6.6l4 3.11A7.2 7.2 0 0 1 12 4.75z"
      />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const safeRedirect = redirect?.startsWith("/") ? redirect : "/";

  useEffect(() => {
    if (!loading && user) navigate({ to: safeRedirect });
  }, [loading, user, navigate, safeRedirect]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${safeRedirect}`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session) toast.success("Account created — you're signed in.");
        else toast.success("Check your inbox to verify your email address.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (!email) {
      toast.error("Enter your email address first.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset link sent — check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send reset email");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "apple") {
    setBusy(true);
    try {
      sessionStorage.setItem("vaultra.redirect", safeRedirect);
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Sign-in failed");
        return;
      }
      if (result.redirected) return;
      navigate({ to: safeRedirect });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="px-4 pt-14 pb-10">
      <div className="mx-auto max-w-sm">
        <h1 className="font-display text-3xl font-bold">
          {mode === "signin" ? "Welcome back" : "Create your vault"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sync your collection, portfolio and sales log across every device.
        </p>

        <div className="mt-6 space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => oauth("google")}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-surface py-3 text-sm font-semibold disabled:opacity-60"
          >
            <GoogleIcon /> Continue with Google
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => oauth("apple")}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-surface py-3 text-sm font-semibold disabled:opacity-60"
          >
            <AppleIcon /> Continue with Apple
          </button>
        </div>

        <div className="my-5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or use email{" "}
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-2.5">
          {mode === "signup" && (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              autoComplete="nickname"
              className="w-full rounded-xl bg-surface px-3.5 py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full rounded-xl bg-surface px-3.5 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            minLength={6}
            placeholder="Password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="w-full rounded-xl bg-surface px-3.5 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={busy}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground",
              busy && "opacity-70",
            )}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-center text-xs text-muted-foreground"
        >
          {mode === "signin"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
