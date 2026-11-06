"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useBank } from "@/lib/ui/bank-store";
import { fmtMoney } from "@/lib/ui/format";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Field";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { IconArrowRight, IconBill, IconExchange, IconLock, IconSend } from "@/components/ui/Icons";
import { CardVisual, CreditUsage, cardStatusBadge } from "@/components/bank/CardVisual";
import { TransactionRow } from "@/components/bank/TransactionRow";
import { NAV } from "@/components/layout/nav";

type Action = "transfer" | "bill" | "fx" | "block" | null;

const FX_RATE = 4.9735; // EUR/RON ilustrativ

export default function HomePage() {
  const { data, loading, error, cardAction } = useBank();
  const toast = useToast();
  const [action, setAction] = useState<Action>(null);
  const [fxAmount, setFxAmount] = useState("100");
  const [billProvider, setBillProvider] = useState("Enel Energie");
  const [billAmount, setBillAmount] = useState("215,40");
  const [blockCardId, setBlockCardId] = useState("");
  const [busy, setBusy] = useState(false);

  const recent = useMemo(() => data?.transactions.slice(0, 10) ?? [], [data]);
  // computed only after the snapshot arrives (client-side), never during prerender
  const greeting = useMemo(() => {
    if (!data) return "Bună";
    const hour = new Date().getHours();
    return hour < 12 ? "Bună dimineața" : hour < 18 ? "Bună ziua" : "Bună seara";
  }, [data]);

  if (loading) return <PageSkeleton />;
  if (error || !data)
    return (
      <Card title="Nu am putut încărca datele">
        <p className="text-sm text-danger">{error ?? "Date indisponibile"}</p>
      </Card>
    );

  const { customer, accounts, cards, roundUp, loans } = data;
  const blockCard = async () => {
    const card = cards.find((c) => c.id === blockCardId);
    if (!card) return;
    setBusy(true);
    try {
      await cardAction(card.id, card.status === "active" ? "block" : "unblock");
      toast.success(`Card ••••${card.last4} ${card.status === "active" ? "blocat" : "deblocat"}`);
      setAction(null);
    } catch (e) {
      toast.error("Nu am putut modifica cardul", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const fxNum = Number(fxAmount.replace(",", ".")) || 0;
  const totalRon = accounts.filter((a) => a.currency === "RON").reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, {customer.firstName}!
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Pachet {customer.package} · client din {new Date(customer.customerSince).getFullYear()} · total în RON{" "}
            <span className="font-semibold text-ink">{fmtMoney(totalRon, "RON")}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<IconSend size={16} />} onClick={() => setAction("transfer")}>
            Transfer nou
          </Button>
          <Button size="sm" variant="secondary" icon={<IconBill size={16} />} onClick={() => setAction("bill")}>
            Plătește factură
          </Button>
          <Button size="sm" variant="secondary" icon={<IconExchange size={16} />} onClick={() => setAction("fx")}>
            Schimb valutar
          </Button>
          <Button size="sm" variant="secondary" icon={<IconLock size={16} />} onClick={() => { setBlockCardId(cards[0]?.id ?? ""); setAction("block"); }}>
            Blochează card
          </Button>
        </div>
      </div>

      {/* accounts */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {accounts.map((a, i) => (
          <Link key={a.id} href={a.type === "current" ? "/conturi" : "/economii"} className="block">
            <Card tone={i === 0 ? "orange" : "default"} className="h-full transition-transform hover:-translate-y-0.5">
              <p className={`text-xs font-semibold uppercase tracking-wide ${i === 0 ? "text-white/80" : "text-ink-muted"}`}>{a.name}</p>
              <Money amount={a.balance} currency={a.currency} size="xl" className="mt-1 block" />
              <p className={`mt-1 text-xs ${i === 0 ? "text-white/80" : "text-ink-muted"}`}>
                Disponibil {fmtMoney(a.available, a.currency)}
                {a.rate !== undefined ? ` · ${a.rate.toFixed(2)}% p.a.` : ""}
              </p>
              <p className={`mt-2 font-mono text-[10px] ${i === 0 ? "text-white/70" : "text-ink-faint"}`}>{a.iban}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* cards strip */}
      <Card title="Cardurile mele" subtitle="Debit, credit și virtual" action={<Link href="/conturi" className="text-xs font-semibold text-ing-orange-dark hover:underline">Gestionează</Link>}>
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <div key={c.id}>
              <CardVisual card={c} compact />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-ink-muted">
                  {c.type === "virtual" ? "Pentru plăți online" : c.type === "credit" ? "Scadență 20 nov." : "Cont Curent RON"}
                </span>
                {cardStatusBadge(c.status)}
              </div>
              {c.type === "credit" && <CreditUsage card={c} className="mt-2" />}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* recent tx */}
        <Card
          title="Ultimele tranzacții"
          subtitle="Toate conturile"
          className="lg:col-span-2"
          action={
            <Link href="/tranzactii" className="inline-flex items-center gap-1 text-xs font-semibold text-ing-orange-dark hover:underline">
              Vezi toate <IconArrowRight size={14} />
            </Link>
          }
        >
          <div className="-mx-2 divide-y divide-line/60">
            {recent.map((t) => (
              <TransactionRow key={t.id} tx={t} />
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          {/* savings widget */}
          <Card title="Economii" subtitle="Round Up luna aceasta">
            <div className="flex items-baseline justify-between">
              <Money amount={roundUp.thisMonth} currency="RON" size="lg" />
              <span className="text-xs text-ink-muted">rotunjire la {roundUp.roundTo} RON</span>
            </div>
            <ProgressBar value={roundUp.thisMonth / 50} className="mt-2" tone="success" />
            <p className="mt-2 text-xs text-ink-muted">
              Total economisit prin Round Up <strong className="text-ink">{fmtMoney(roundUp.totalSaved, "RON")}</strong> · bonus {roundUp.bonusRatePct}% la final de an.
            </p>
            <Link href="/economii" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-ing-orange-dark hover:underline">
              Vezi economiile <IconArrowRight size={14} />
            </Link>
          </Card>

          {/* loans mini */}
          <Card title="Credite" subtitle="Următoarea rată">
            {loans
              .filter((l) => l.type === "personal")
              .map((l) => (
                <div key={l.id}>
                  <div className="flex items-baseline justify-between">
                    <Money amount={l.monthlyPayment ?? 0} currency={l.currency} size="lg" />
                    <span className="text-xs text-ink-muted">15 nov. 2026</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {l.name} · rămas {fmtMoney(l.outstanding, l.currency)}
                  </p>
                </div>
              ))}
          </Card>
        </div>
      </div>

      {/* products grid */}
      <Card title="Produse și servicii" subtitle="Toate secțiunile Home'Bank">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {NAV.filter((n) => n.href !== "/").map((n) => {
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm font-medium hover:border-ing-orange hover:bg-ing-orange-soft">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ing-orange-soft text-ing-orange">
                  <Icon size={18} />
                </span>
                {n.label}
              </Link>
            );
          })}
        </div>
      </Card>

      {/* modals */}
      <Modal open={action === "transfer"} onClose={() => setAction(null)} title="Transfer nou" footer={<Link href="/plati" className="inline-flex"><Button onClick={() => setAction(null)}>Mergi la Plăți</Button></Link>}>
        <p className="text-ink-muted">Transferurile se inițiază din secțiunea Plăți, unde ai beneficiarii salvați și confirmarea pas cu pas.</p>
      </Modal>

      <Modal
        open={action === "bill"}
        onClose={() => setAction(null)}
        title="Plătește factură"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>Renunță</Button>
            <Button onClick={() => { toast.success(`Factură ${billProvider} plătită`, `${billAmount} RON (simulare, fără scriere)`); setAction(null); }}>Plătește</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Furnizor">
            <Select value={billProvider} onChange={(e) => setBillProvider(e.target.value)}>
              {["Enel Energie", "Engie", "Digi", "Apa Nova"].map((p) => <option key={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Sumă (RON)">
            <Input value={billAmount} onChange={(e) => setBillAmount(e.target.value)} inputMode="decimal" />
          </Field>
          <p className="text-xs text-ink-muted">Demo: plata nu este înregistrată în mock-ul de core banking.</p>
        </div>
      </Modal>

      <Modal open={action === "fx"} onClose={() => setAction(null)} title="Schimb valutar" footer={<><Button variant="secondary" onClick={() => setAction(null)}>Renunță</Button><Button onClick={() => { toast.success("Schimb valutar efectuat (simulare)", `${fmtMoney(fxNum * FX_RATE, "RON")} → ${fmtMoney(fxNum, "EUR")}`); setAction(null); }}>Schimbă</Button></>}>
        <div className="space-y-3">
          <Field label="Cumperi (EUR)">
            <Input value={fxAmount} onChange={(e) => setFxAmount(e.target.value)} inputMode="decimal" />
          </Field>
          <div className="rounded-lg bg-surface px-3 py-2 text-sm">
            Plătești <strong>{fmtMoney(fxNum * FX_RATE, "RON")}</strong> din Cont Curent RON · curs ilustrativ 1 EUR = {FX_RATE.toFixed(4)} RON
          </div>
        </div>
      </Modal>

      <Modal
        open={action === "block"}
        onClose={() => setAction(null)}
        title="Blochează / deblochează card"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>Renunță</Button>
            <Button variant={cards.find((c) => c.id === blockCardId)?.status === "active" ? "danger" : "primary"} loading={busy} onClick={blockCard}>
              {cards.find((c) => c.id === blockCardId)?.status === "active" ? "Blochează" : "Deblochează"}
            </Button>
          </>
        }
      >
        <Field label="Card">
          <Select value={blockCardId} onChange={(e) => setBlockCardId(e.target.value)}>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.brand} ••••{c.last4} · {c.status === "active" ? "activ" : "blocat"}
              </option>
            ))}
          </Select>
        </Field>
        <p className="mt-3 text-xs text-ink-muted">Acțiunea apelează POST /api/bank/cards/:id/block sau /unblock și reîmprospătează datele.</p>
      </Modal>
    </div>
  );
}
