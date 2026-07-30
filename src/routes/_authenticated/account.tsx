import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Loader2, LogOut, MailCheck, MailWarning } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Your account — Vaultra" },
      {
        name: "description",
        content:
          "Manage your Vaultra account: email verification status, password changes and signing out.",
      },
      { property: "og:title", content: "Your account — Vaultra" },
      {
        property: "og:description",
        content: "Email verification, password changes and session management.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const verified = Boolean(user?.email_confirmed_at);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      toast.success("Password updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update password");
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    if (!user?.email) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
      if (error) throw error;
      toast.success("Verification email sent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the email");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="px-4 pt-5 pb-10">
      <Link
        to="/profile"
        className="grid size-9 place-items-center rounded-xl bg-surface"
        aria-label="Back to profile"
      >
        <ChevronLeft className="size-5" />
      </Link>

      <h1 className="mt-4 font-display text-2xl font-bold">Your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>

      <section className="mt-5 rounded-2xl bg-surface p-4">
        <div className="flex items-start gap-3">
          {verified ? (
            <MailCheck className="mt-0.5 size-5 text-success" />
          ) : (
            <MailWarning className="mt-0.5 size-5 text-accent" />
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {verified ? "Email verified" : "Email not verified"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {verified
                ? "Your address is confirmed, so password resets and alerts will reach you."
                : "Confirm your address to secure your account and enable password resets."}
            </p>
            {!verified && (
              <button
                type="button"
                disabled={busy}
                onClick={resendVerification}
                className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs font-semibold disabled:opacity-60"
              >
                Resend verification email
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl bg-surface p-4">
        <h2 className="text-sm font-semibold">Change password</h2>
        <form onSubmit={changePassword} className="mt-2 space-y-2">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            minLength={6}
            placeholder="New password"
            autoComplete="new-password"
            className="w-full rounded-xl bg-surface-2 px-3.5 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />} Update password
          </button>
        </form>
      </section>

      <button
        type="button"
        onClick={signOut}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-surface py-3 text-sm font-semibold text-destructive"
      >
        <LogOut className="size-4" /> Sign out
      </button>
    </main>
  );
}
