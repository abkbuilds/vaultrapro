import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset your password — Vaultra" },
      {
        name: "description",
        content: "Choose a new password for your Vaultra account and get back to your collection.",
      },
      { property: "og:title", content: "Reset your password — Vaultra" },
      {
        property: "og:description",
        content: "Set a new password for your Vaultra account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
      setReady(true);
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated — you're signed in.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="px-4 pt-14 pb-10">
      <div className="mx-auto max-w-sm">
        <h1 className="font-display text-3xl font-bold">Set a new password</h1>
        {!ready ? (
          <div className="mt-6 grid h-24 place-items-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : hasSession ? (
          <form onSubmit={onSubmit} className="mt-6 space-y-2.5">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={6}
              placeholder="New password"
              autoComplete="new-password"
              className="w-full rounded-xl bg-surface px-3.5 py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy && <Loader2 className="size-4 animate-spin" />} Update password
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            This reset link is invalid or has expired. Request a new one from the sign-in
            page.
          </p>
        )}
      </div>
    </main>
  );
}
