import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Handshake, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, money } from "@/components/tcg/CardBits";
import { searchCards } from "@/lib/catalog/queries";
import {
  TRADE_VENUES,
  tradeTotals,
  useTrades,
  type TradeKind,
  type TradeVenue,
} from "@/lib/tcg/trades";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trades")({
  head: () => ({
    meta: [
      { title: "Trade & Sales Log — Vaultra" },
      {
        name: "description",
        content:
          "Log card sales, trades and card-show deals in seconds and track your realised profit across every venue.",
      },
      { property: "og:title", content: "Trade & Sales Log — Vaultra" },
      {
        property: "og:description",
        content: "Track realised profit from sales, trades and card-show deals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TradesPage,
});

const KINDS: { id: TradeKind; label: string }[] = [
  { id: "sale", label: "Sold" },
  { id: "purchase", label: "Bought" },
  { id: "trade", label: "Traded" },
];

function TradesPage() {
  const { trades, addTrade, removeTrade } = useTrades();
  const totals = useMemo(() => tradeTotals(trades), [trades]);

  const [kind, setKind] = useState<TradeKind>("sale");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<{ id: string; name: string; setLabel: string } | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [fees, setFees] = useState("");
  const [venue, setVenue] = useState<TradeVenue>("Card show");
  const [counterparty, setCounterparty] = useState("");
  const [receivedFor, setReceivedFor] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const search = useQuery({
    queryKey: ["trade-card-search", q],
    queryFn: () => searchCards({ query: q, pageSize: 8 }),
    enabled: q.trim().length > 1 && !picked,
  });

  function submit() {
    if (!picked) return toast.error("Pick a card first");
    const price = Number(unitPrice);
    if (!Number.isFinite(price) || price < 0) return toast.error("Enter a valid amount");
    addTrade({
      kind,
      cardId: picked.id,
      cardName: picked.name,
      setLabel: picked.setLabel,
      quantity: Math.max(1, Number(quantity) || 1),
      unitPrice: price,
      fees: Number(fees) || 0,
      venue,
      counterparty: counterparty.trim(),
      receivedFor: receivedFor.trim(),
      date,
      notes: notes.trim(),
    });
    toast.success(`${picked.name} logged`);
    setPicked(null);
    setQ("");
    setUnitPrice("");
    setFees("");
    setCounterparty("");
    setReceivedFor("");
    setNotes("");
    setQuantity("1");
  }

  return (
    <main>
      <PageHeader title="Trades & sales" subtitle="Every deal, show and flip in one ledger" />

      <section className="grid grid-cols-3 gap-2 px-4">
        {[
          { label: "Realised P/L", value: totals.realized, tone: true },
          { label: "Sold", value: totals.sold },
          { label: "Spent", value: totals.spent },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-surface p-3">
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
            <p
              className={cn(
                "mt-1 text-sm font-bold tabular-nums",
                s.tone && (s.value >= 0 ? "text-success" : "text-destructive"),
              )}
            >
              {money(s.value)}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-5 px-4">
        <div className="glass-panel space-y-3 rounded-3xl p-4">
          <div className="flex gap-1 rounded-xl bg-surface-2/70 p-1">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors",
                  kind === k.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>

          {picked ? (
            <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5">
              <Check className="size-4 text-success" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{picked.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{picked.setLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="text-xs font-semibold text-muted-foreground"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5">
                <Search className="size-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search card name or set number"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {search.isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </label>
              {(search.data?.cards ?? []).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setPicked({
                      id: c.id,
                      name: c.name,
                      setLabel: `${c.setName} · ${c.number} · ${c.language}`,
                    })
                  }
                  className="flex w-full items-center gap-3 rounded-xl bg-surface px-3 py-2 text-left"
                >
                  <img src={c.image} alt="" className="h-10 w-7 rounded object-cover" loading="lazy" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {c.setName} · {c.number}
                    </span>
                  </span>
                  <span className="text-xs font-semibold tabular-nums">{money(c.marketPrice)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field label="Quantity">
              <input
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="input-bare"
              />
            </Field>
            <Field label={kind === "trade" ? "Cash difference" : "Price each"}>
              <input
                inputMode="decimal"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                className="input-bare"
              />
            </Field>
            <Field label="Fees / shipping">
              <input
                inputMode="decimal"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                placeholder="0.00"
                className="input-bare"
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-bare"
              />
            </Field>
            <Field label="Venue">
              <select
                value={venue}
                onChange={(e) => setVenue(e.target.value as TradeVenue)}
                className="input-bare"
              >
                {TRADE_VENUES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Counterparty">
              <input
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="Buyer / seller"
                className="input-bare"
              />
            </Field>
          </div>

          {kind === "trade" && (
            <Field label="Received in return">
              <input
                value={receivedFor}
                onChange={(e) => setReceivedFor(e.target.value)}
                placeholder="e.g. Umbreon VMAX 215/203"
                className="input-bare"
              />
            </Field>
          )}

          <Field label="Notes">
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Table 42, Manchester Card Show"
              className="input-bare"
            />
          </Field>

          <button
            type="button"
            onClick={submit}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground active:opacity-90"
          >
            <Handshake className="size-4" /> Log {KINDS.find((k) => k.id === kind)!.label.toLowerCase()}
          </button>
        </div>
      </section>

      <section className="mt-6 px-4">
        <h2 className="pb-2 font-display text-lg font-semibold">Ledger</h2>
        <div className="space-y-2">
          {trades.map((t) => {
            const gross = t.unitPrice * t.quantity - t.fees;
            const positive = t.kind !== "purchase";
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {t.cardName} <span className="text-muted-foreground">×{t.quantity}</span>
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {[t.date, t.venue, t.counterparty, t.receivedFor && `for ${t.receivedFor}`, t.notes]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p
                  className={cn(
                    "shrink-0 text-sm font-bold tabular-nums",
                    positive ? "text-success" : "text-destructive",
                  )}
                >
                  {positive ? "+" : "−"}
                  {money(Math.abs(gross))}
                </p>
                <button
                  type="button"
                  onClick={() => removeTrade(t.id)}
                  aria-label="Delete entry"
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
          {!trades.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No deals logged yet. Add your first sale or card-show trade above.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
