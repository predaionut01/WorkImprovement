"use client";

import { useState } from "react";
import { useBank } from "@/lib/ui/bank-store";
import { fmtDate, fmtMoney } from "@/lib/ui/format";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/Skeleton";

function annuity(principal: number, annualRatePct: number, months: number): number {
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs font-semibold text-ink-muted">
        {label}
        <span className="text-ink">{format(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full" />
    </label>
  );
}

export default function LoansPage() {
  const { data, loading } = useBank();
  const [price, setPrice] = useState(450000);
  const [advancePct, setAdvancePct] = useState(15);
  const [years, setYears] = useState(25);
  const [rate, setRate] = useState(6.5);
  if (loading || !data) return <PageSkeleton />;

  const personal = data.loans.find((l) => l.type === "personal");
  const cc = data.loans.find((l) => l.type === "credit_card");
  const od = data.loans.find((l) => l.type === "overdraft");
  const principal = price * (1 - advancePct / 100);
  const monthly = annuity(principal, rate, years * 12);
  const totalPaid = monthly * years * 12;

  return (
    <div className="space-y-5">
      <PageHeader title="Credite" subtitle="Creditele active și un simulator ipotecar" />

      <div className="grid gap-4 lg:grid-cols-3">
        {personal && (
          <Card title={personal.name} subtitle={`DAE ${personal.rate.toFixed(2)}% · ${personal.status === "active" ? "activ" : personal.status}`} action={<Badge tone="success" dot>La zi</Badge>}>
            <p className="text-xs text-ink-muted">Sold rămas</p>
            <Money amount={personal.outstanding} currency={personal.currency} size="xl" />
            <ProgressBar value={1 - personal.outstanding / (personal.principal ?? personal.outstanding)} className="mt-3" tone="success" />
            <p className="mt-1 text-[11px] text-ink-muted">
              Rambursat {fmtMoney((personal.principal ?? 0) - personal.outstanding, personal.currency)} din {fmtMoney(personal.principal ?? 0, personal.currency, { decimals: 0 })}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-ink-muted">Rata lunară</dt>
              <dd className="text-right font-semibold">{fmtMoney(personal.monthlyPayment ?? 0, personal.currency)}</dd>
              <dt className="text-ink-muted">Următoarea plată</dt>
              <dd className="text-right">{personal.nextPaymentDate ? fmtDate(personal.nextPaymentDate) : "—"}</dd>
              <dt className="text-ink-muted">Luni rămase</dt>
              <dd className="text-right">{personal.remainingMonths}</dd>
            </dl>
          </Card>
        )}
        {cc && (
          <Card title={cc.name} subtitle={`Dobândă ${cc.rate.toFixed(2)}% · perioadă de grație până la 55 zile`}>
            <p className="text-xs text-ink-muted">Utilizat</p>
            <Money amount={cc.used ?? 0} currency={cc.currency} size="xl" />
            <ProgressBar value={(cc.used ?? 0) / (cc.limit ?? 1)} className="mt-3" />
            <p className="mt-1 text-[11px] text-ink-muted">
              Limită {fmtMoney(cc.limit ?? 0, cc.currency, { decimals: 0 })} · disponibil {fmtMoney((cc.limit ?? 0) - (cc.used ?? 0), cc.currency)}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-ink-muted">Plata minimă</dt>
              <dd className="text-right font-semibold">{fmtMoney(cc.monthlyPayment ?? 0, cc.currency)}</dd>
              <dt className="text-ink-muted">Scadență</dt>
              <dd className="text-right">{cc.nextPaymentDate ? fmtDate(cc.nextPaymentDate) : "—"}</dd>
            </dl>
          </Card>
        )}
        {od && (
          <Card title={od.name} subtitle={`Descoperit de cont · ${od.rate.toFixed(2)}% doar pe suma folosită`}>
            <p className="text-xs text-ink-muted">Utilizat</p>
            <Money amount={od.used ?? 0} currency={od.currency} size="xl" />
            <ProgressBar value={(od.used ?? 0) / (od.limit ?? 1)} className="mt-3" tone="neutral" />
            <p className="mt-1 text-[11px] text-ink-muted">Limită {fmtMoney(od.limit ?? 0, od.currency, { decimals: 0 })} · disponibil integral</p>
            <p className="mt-3 text-sm text-ink-muted">Se activează automat când soldul contului curent ajunge la zero.</p>
          </Card>
        )}
      </div>

      <Card title="Simulator credit ipotecar" subtitle="Calcul orientativ, făcut local în browser" action={<Badge tone="warning">Simulare</Badge>}>
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <Slider label="Preț locuință" value={price} min={100000} max={1500000} step={10000} onChange={setPrice} format={(v) => fmtMoney(v, "RON", { decimals: 0 })} />
            <Slider label="Avans" value={advancePct} min={5} max={50} step={1} onChange={setAdvancePct} format={(v) => `${v}% · ${fmtMoney(price * (v / 100), "RON", { decimals: 0 })}`} />
            <Slider label="Perioadă" value={years} min={5} max={30} step={1} onChange={setYears} format={(v) => `${v} ani`} />
            <Slider label="Dobândă anuală" value={rate} min={3} max={10} step={0.1} onChange={setRate} format={(v) => `${v.toFixed(1)}%`} />
          </div>
          <div className="rounded-xl bg-surface p-4">
            <p className="text-xs text-ink-muted">Rată lunară estimată</p>
            <Money amount={monthly} currency="RON" size="xl" />
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Suma împrumutată</dt>
                <dd>{fmtMoney(principal, "RON", { decimals: 0 })}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Total de rambursat</dt>
                <dd>{fmtMoney(totalPaid, "RON", { decimals: 0 })}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Dobândă totală</dt>
                <dd>{fmtMoney(totalPaid - principal, "RON", { decimals: 0 })}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] leading-snug text-ink-faint">
              Simulare orientativă, fără comisioane, asigurări sau DAE. Nu reprezintă o ofertă. Pentru o ofertă personalizată discută cu un consilier.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
