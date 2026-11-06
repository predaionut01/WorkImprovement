"use client";

import { useState } from "react";
import { useBank } from "@/lib/ui/bank-store";
import { fmtMoney, maskIban } from "@/lib/ui/format";
import type { Card as CardT } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { IconCheck, IconCopy } from "@/components/ui/Icons";
import { CardVisual, CreditUsage, cardStatusBadge } from "@/components/bank/CardVisual";

function CopyIban({ iban }: { iban: string }) {
  const [ok, setOk] = useState(false);
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(iban);
      setOk(true);
      toast.success("IBAN copiat");
      setTimeout(() => setOk(false), 1500);
    } catch {
      toast.error("Nu am putut copia IBAN-ul");
    }
  };
  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-ink-muted hover:border-ing-orange hover:text-ing-orange-dark cursor-pointer" aria-label="Copiază IBAN">
      {ok ? <IconCheck size={13} /> : <IconCopy size={13} />}
      {ok ? "Copiat" : "Copiază"}
    </button>
  );
}

function CardPanel({ card }: { card: CardT }) {
  const { cardAction, accountById } = useBank();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const acc = accountById(card.accountId);

  const run = async (action: "block" | "unblock" | "contactless" | "online", value?: boolean, okMsg?: string) => {
    setBusy(action);
    try {
      await cardAction(card.id, action, value);
      if (okMsg) toast.success(okMsg);
    } catch (e) {
      toast.error("Operațiune eșuată", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const blocked = card.status !== "active";

  return (
    <Card padded={false}>
      <div className="grid gap-4 p-4 md:grid-cols-[260px_1fr]">
        <CardVisual card={card} />
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">
                {card.brand} ••••{card.last4}
              </p>
              <p className="text-xs text-ink-muted">
                {acc?.name ?? card.accountId} · expiră {card.expiry}
                {card.walletEnrolled?.length ? ` · ${card.walletEnrolled.join(", ")}` : ""}
              </p>
            </div>
            {cardStatusBadge(card.status)}
          </div>
          {card.type === "credit" && <CreditUsage card={card} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
              <span className="text-sm">Contactless</span>
              <Toggle size="sm" checked={card.contactless} disabled={blocked || busy !== null} onChange={(v) => run("contactless", v, v ? "Contactless activat" : "Contactless dezactivat")} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
              <span className="text-sm">Plăți online</span>
              <Toggle size="sm" checked={card.onlinePayments} disabled={blocked || busy !== null} onChange={(v) => run("online", v, v ? "Plăți online activate" : "Plăți online dezactivate")} />
            </div>
          </div>
          <div className="mt-auto flex flex-wrap gap-2">
            {blocked ? (
              <Button size="sm" loading={busy === "unblock"} onClick={() => run("unblock", undefined, `Card ••••${card.last4} deblocat`)}>
                Deblochează
              </Button>
            ) : (
              <Button size="sm" variant="danger" loading={busy === "block"} onClick={() => run("block", undefined, `Card ••••${card.last4} blocat`)}>
                Blochează
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => toast.push("PIN-ul se afișează doar în aplicația mobilă (demo)")}>
              Vezi PIN
            </Button>
            <Button size="sm" variant="secondary" onClick={() => toast.push("Limitele de tranzacționare nu sunt modelate în PoC")}>
              Limite
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function AccountsPage() {
  const { data, loading } = useBank();
  const toast = useToast();
  const [virtualOpen, setVirtualOpen] = useState(false);
  if (loading || !data) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Conturi & Carduri" subtitle="Conturile tale și cardurile atașate" />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Conturi</h2>
        <div className="grid gap-3">
          {data.accounts.map((a) => (
            <Card key={a.id} padded={false}>
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{a.name}</p>
                    <Badge tone={a.type === "current" ? "info" : "success"}>{a.type === "current" ? "Cont curent" : a.type === "savings" ? "Economii" : "Round Up"}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-ink-muted">{maskIban(a.iban)}</span>
                    <CopyIban iban={a.iban} />
                  </div>
                </div>
                <div className="text-right">
                  <Money amount={a.balance} currency={a.currency} size="lg" />
                  <p className="text-xs text-ink-muted">
                    disponibil {fmtMoney(a.available, a.currency)}
                    {a.rate !== undefined ? ` · dobândă ${a.rate.toFixed(2)}%` : ""}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Carduri</h2>
          <Button size="sm" variant="secondary" onClick={() => setVirtualOpen(true)}>
            + Card virtual nou
          </Button>
        </div>
        <div className="grid gap-3">
          {data.cards.map((c) => (
            <CardPanel key={c.id} card={c} />
          ))}
        </div>
      </section>

      <Modal
        open={virtualOpen}
        onClose={() => setVirtualOpen(false)}
        title="Card virtual nou"
        footer={
          <>
            <Button variant="secondary" onClick={() => setVirtualOpen(false)}>Renunță</Button>
            <Button onClick={() => { toast.success("Cerere înregistrată (simulare)", "În PoC nu se emit carduri noi."); setVirtualOpen(false); }}>Emite card</Button>
          </>
        }
      >
        <p className="text-ink-muted">Cardul virtual Visa se emite instant, fără cost, pentru plăți online. Datele se afișează doar în aplicația mobilă.</p>
      </Modal>
    </div>
  );
}
