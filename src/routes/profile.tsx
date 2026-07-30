import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Bell, ChevronRight, Heart, LogIn, LogOut, Plug, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, CardRow, money } from "@/components/tcg/CardBits";
import { useCollection, valueEntries } from "@/lib/tcg/collection";
import { CARD_BY_ID } from "@/lib/tcg/cards";
import { useAuth } from "@/lib/auth";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile & Settings — Vaultra" },
      {
        name: "description",
        content:
          "Manage your Vaultra account, connected marketplaces, wishlist and price alert preferences.",
      },
      { property: "og:title", content: "Profile & Settings — Vaultra" },
      {
        property: "og:description",
        content: "Connected marketplaces, wishlist and notification settings.",
      },
    ],
  }),
  component: ProfilePage,
});

const PIE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
];

/** Real status of each price source wired into the app. */
const MARKETPLACES = [
  { name: "TCGplayer (EN)", status: "Live" },
  { name: "Cardmarket (EN + JP)", status: "Live" },
  { name: "eBay sold", status: "Needs API credentials" },
  { name: "PriceCharting", status: "Needs API token" },
  { name: "snkrdunk (JP)", status: "Needs partner feed" },
];

function ProfilePage() {
  const { entries, wishlist } = useCollection();
  const { user, signOut } = useAuth();
  const valued = useMemo(() => valueEntries(entries), [entries]);

  const allocation = useMemo(() => {
    const map = new Map<string, number>();
    valued.forEach((e) => {
      const key = `${e.card.language === "JP" ? "Pokémon JP" : "Pokémon EN"}`;
      map.set(key, (map.get(key) ?? 0) + e.value);
    });
    return [...map].map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));
  }, [valued]);

  return (
    <main>
      <PageHeader
        title="Profile"
        subtitle={user?.email ?? "Not signed in — tap below to sync your vault"}
      />

      <section className="px-4">
        <div className="glass-panel rounded-3xl p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Allocation
          </p>
          <div className="flex items-center gap-3">
            <div className="h-32 w-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocation}
                    dataKey="value"
                    innerRadius={34}
                    outerRadius={58}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {allocation.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v) => money(Number(v))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-1.5">
              {allocation.map((a, i) => (
                <li key={a.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="flex-1 truncate">{a.name}</span>
                  <span className="font-semibold tabular-nums">{money(a.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-6 px-4">
        <h2 className="flex items-center gap-2 pb-2 font-display text-lg font-semibold">
          <Plug className="size-4 text-primary" /> Connected marketplaces
        </h2>
        <div className="divide-y divide-border overflow-hidden rounded-2xl bg-surface">
          {MARKETPLACES.map((m) => (
            <div key={m.name} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium">{m.name}</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {m.status}
                <ChevronRight className="size-4" />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 px-4">
        <h2 className="flex items-center gap-2 pb-2 font-display text-lg font-semibold">
          <Bell className="size-4 text-primary" /> Notifications
        </h2>
        <div className="divide-y divide-border overflow-hidden rounded-2xl bg-surface">
          {[
            ["Weekly market recap", true],
            ["Price alerts on my cards", true],
            ["Wishlist price drops", false],
          ].map(([label, on]) => (
            <label
              key={String(label)}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className="text-sm font-medium">{label}</span>
              <Switch defaultChecked={Boolean(on)} />
            </label>
          ))}
        </div>
      </section>

      <section className="mt-6 px-4">
        <h2 className="flex items-center gap-2 pb-2 font-display text-lg font-semibold">
          <Heart className="size-4 text-accent" /> Wishlist
        </h2>
        <div className="space-y-2">
          {wishlist
            .map((id) => CARD_BY_ID.get(id))
            .filter(Boolean)
            .map((card) => (
              <CardRow
                key={card!.id}
                card={card!}
                right={
                  <span className="text-sm font-bold tabular-nums">
                    {money(card!.marketPrice)}
                  </span>
                }
              />
            ))}
          {wishlist.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nothing wishlisted yet.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 space-y-2 px-4">
        <Link
          to="/onboarding"
          className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" /> Replay intro tour
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        {user ? (
          <button
            type="button"
            onClick={async () => {
              await signOut();
              toast("Signed out");
            }}
            className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 text-sm font-medium text-destructive"
          >
            <span className="flex items-center gap-2">
              <LogOut className="size-4" /> Sign out
            </span>
          </button>
        ) : (
          <Link
            to="/auth"
            search={{ redirect: "/profile" }}
            className="flex items-center justify-between rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            <span className="flex items-center gap-2">
              <LogIn className="size-4" /> Sign in or create account
            </span>
            <ChevronRight className="size-4" />
          </Link>
        )}
      </section>
    </main>
  );
}
