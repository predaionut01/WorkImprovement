"use client";

import { useState } from "react";
import { useBank } from "@/lib/ui/bank-store";
import { fmtDate, fmtMoney, monthsBetween } from "@/lib/ui/format";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Money } from "@/components/ui/Money";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { Field, Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

const RATES = [
  { term: 12, rate: 5.25, label: "12 luni", note: "dobândă standard" },
  { term: 6, rate: 5.75, label: "6 luni", note: "bonus, bani noi" },
  { term: 3, rate: 4.5, label: "3 luni", note: "dobândă standard" },
] as const;

export default function SavingsPage() {
  const { data, loading } = useBank();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState<string>("12");
  const [amount, setAmount] = useState("10000");
  if (loading || !data) return <PageSkeleton />;

  const savings = data.accounts.filter((a) => a.type === "savings");
  const roundupAcc = data.accounts.find((a) => a.id === data.roundUp.savingsAccountId);
  const r = RATES.find((x) => String(x.term) === term) ?? RATES[0];
  const amt = Number(amount.replace(",", ".")) || 0;
  const interest = (amt * (r.rate / 100) * r.term) / 12;
  const totalSavings = savings.reduce((s, a) => s + a.balance, 0) + (roundupAcc?.balance ?? 0) + data.deposits.reduce((s, d) => s + d.principal, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Economii" subtitle={`Total economii și depozite ${fmtMoney(totalSavings, "RON")}`} action={<Button onClick={() => setOpen(true)}>Deschide depozit nou</Button>} />

      <div className="grid gap-4 md:grid-cols-2">
        {savings.map((a) => (
          <Card key={a.id} tone="orange">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{a.name}</p>
            <Money amount={a.balance} currency={a.currency} size="xl" className="mt-1 block" />
            <p className="mt-1 text-xs text-white/85">Dobândă {a.rate?.toFixed(2)}% p.a., plătită lunar · fără sumă minimă · retragere oricând</p>
            <p className="mt-2 font-mono text-[10px] text-white/70">{a.iban}</p>
          </Card>
        ))}
        <Card title="Round Up" subtitle="Economisește din rest, automat" action={<Badge tone={data.roundUp.enabled ? "success" : "neutral"} dot>{data.roundUp.enabled ? "Activ" : "Oprit"}</Badge>}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-ink-muted">Total economisit</p>
              <Money amount={data.roundUp.totalSaved} currency="RON" size="lg" />
            </div>
            <div>
              <p className="text-xs text-ink-muted">Luna aceasta</p>
              <Money amount={data.roundUp.thisMonth} currency="RON" size="lg" />
            </div>
            <div>
              <p className="text-xs text-ink-muted">Rotunjire la</p>
              <p className="font-semibold">{data.roundUp.roundTo} RON</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Bonus anual</p>
              <p className="font-semibold">{data.roundUp.bonusRatePct}% din sumele economisite</p>
            </div>
          </div>
          <ProgressBar value={data.roundUp.thisMonth / 50} tone="success" className="mt-3" />
          <p className="mt-1 text-[11px] text-ink-muted">Obiectiv lunar ilustrativ: 50 RON.</p>
        </Card>
      </div>

      <Card title="Depozite la termen" padded={false}>
        <div className="divide-y divide-line/60">
          {data.deposits.map((d) => {
            const total = d.termMonths;
            const elapsed = Math.min(total, Math.max(0, monthsBetween(d.startDate, "2026-11-06")));
            return (
              <div key={d.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{d.name}</p>
                    <Badge tone="info">{d.rate.toFixed(2)}% p.a.</Badge>
                    <Badge tone={d.autoRenew ? "success" : "neutral"}>{d.autoRenew ? "Reînnoire automată" : "Fără reînnoire"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    Constituit {fmtDate(d.startDate)} · scadență {fmtDate(d.maturityDate)} · {d.termMonths} luni
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <ProgressBar value={elapsed / total} className="flex-1" />
                    <span className="text-[11px] text-ink-muted">
                      {elapsed}/{total} luni
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <Money amount={d.principal} currency={d.currency} size="lg" />
                  <p className="text-xs text-success">+ {fmtMoney(d.interestAccrued, d.currency)} dobândă acumulată</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Dobânzi depozite noi" subtitle="Valori ilustrative pentru demo">
        <div className="grid gap-3 sm:grid-cols-3">
          {RATES.map((x) => (
            <button key={x.term} type="button" onClick={() => { setTerm(String(x.term)); setOpen(true); }} className="rounded-xl border border-line p-4 text-left hover:border-ing-orange hover:bg-ing-orange-soft cursor-pointer">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{x.label}</p>
              <p className="mt-1 text-2xl font-bold text-ing-orange-dark">{x.rate.toFixed(2)}%</p>
              <p className="text-xs text-ink-muted">{x.note}</p>
            </button>
          ))}
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Deschide depozit nou"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Renunță</Button>
            <Button onClick={() => { toast.success("Depozit constituit (simulare)", `${fmtMoney(amt, "RON")} · ${r.label} · ${r.rate}%`); setOpen(false); }}>Constituie depozit</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Termen">
            <Select value={term} onChange={(e) => setTerm(e.target.value)}>
              {RATES.map((x) => (
                <option key={x.term} value={x.term}>
                  {x.label} · {x.rate.toFixed(2)}%
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sumă (RON)">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </Field>
          <div className="rounded-lg bg-surface px-3 py-2 text-sm">
            Dobândă estimată la scadență: <strong>{fmtMoney(interest, "RON")}</strong> (brut, înainte de impozit) · total {fmtMoney(amt + interest, "RON")}
          </div>
          <p className="text-xs text-ink-muted">Demo: depozitul nu este înregistrat în mock-ul de core banking.</p>
        </div>
      </Modal>
    </div>
  );
}
