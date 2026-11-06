"use client";

import { useBank } from "@/lib/ui/bank-store";
import { fmtMoney, fmtNumber, fmtPct } from "@/lib/ui/format";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { Table, type Column } from "@/components/ui/Table";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/Skeleton";
import type { Investment } from "@/lib/types";

const FX_RATE = 4.9735;
const TYPE_LABEL: Record<Investment["type"], string> = { fund: "Fond mutual", etf: "ETF", stock: "Acțiune" };
const TYPE_COLOR: Record<Investment["type"], string> = { fund: "#ff6200", etf: "#2f6fed", stock: "#2e8b57" };

function toRon(i: Investment, v: number) {
  return i.currency === "EUR" ? v * FX_RATE : v;
}

export default function InvestmentsPage() {
  const { data, loading } = useBank();
  if (loading || !data) return <PageSkeleton />;

  const inv = data.investments;
  const totalRon = inv.reduce((s, i) => s + toRon(i, i.value), 0);
  const investedRon = inv.reduce((s, i) => s + toRon(i, i.invested), 0);
  const pnlRon = totalRon - investedRon;
  const alloc = (["fund", "etf", "stock"] as const).map((t) => ({
    type: t,
    value: inv.filter((i) => i.type === t).reduce((s, i) => s + toRon(i, i.value), 0),
  }));

  const columns: Column<Investment>[] = [
    {
      key: "name",
      header: "Instrument",
      render: (i) => (
        <div>
          <p className="font-medium">
            {i.name} {i.ticker && <span className="font-mono text-xs text-ink-muted">({i.ticker})</span>}
          </p>
          <Badge tone="neutral">{TYPE_LABEL[i.type]}</Badge>
        </div>
      ),
    },
    { key: "units", header: "Unități", align: "right", render: (i) => fmtNumber(i.units, i.type === "stock" ? 0 : 2) },
    { key: "price", header: "Preț unitar", align: "right", render: (i) => fmtMoney(i.unitPrice, i.currency) },
    { key: "invested", header: "Investit", align: "right", render: (i) => fmtMoney(i.invested, i.currency) },
    { key: "value", header: "Valoare", align: "right", render: (i) => <Money amount={i.value} currency={i.currency} size="sm" /> },
    {
      key: "pnl",
      header: "P&L",
      align: "right",
      render: (i) => (
        <span className={`font-semibold tabular-nums ${i.pnl >= 0 ? "text-success" : "text-danger"}`}>
          {fmtMoney(i.pnl, i.currency, { sign: true })}
          <span className="ml-1 text-xs">({i.pnlPct >= 0 ? "+" : ""}{fmtPct(i.pnlPct)})</span>
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Investiții" subtitle="Portofoliu: fonduri, ETF-uri și acțiuni · doar vizualizare, fără tranzacționare în PoC" />
      <div className="grid gap-4 md:grid-cols-3">
        <Card tone="dark">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Valoare portofoliu</p>
          <Money amount={totalRon} currency="RON" size="xl" className="mt-1 block" />
          <p className="mt-1 text-xs text-white/70">echivalent RON · curs ilustrativ 1 EUR = {FX_RATE} RON</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Investit</p>
          <Money amount={investedRon} currency="RON" size="xl" className="mt-1 block" />
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Rezultat</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${pnlRon >= 0 ? "text-success" : "text-danger"}`}>
            {fmtMoney(pnlRon, "RON", { sign: true })}
          </p>
          <p className="text-xs text-ink-muted">{pnlRon >= 0 ? "+" : ""}{fmtPct((pnlRon / investedRon) * 100)} față de suma investită</p>
        </Card>
      </div>

      <Card title="Alocare" subtitle="După tipul instrumentului">
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-surface-2">
          {alloc.map((a) => (
            <div key={a.type} style={{ width: `${(a.value / totalRon) * 100}%`, background: TYPE_COLOR[a.type] }} title={TYPE_LABEL[a.type]} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          {alloc.map((a) => (
            <span key={a.type} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLOR[a.type] }} />
              {TYPE_LABEL[a.type]} · {fmtPct((a.value / totalRon) * 100, 1)} · {fmtMoney(a.value, "RON", { decimals: 0 })}
            </span>
          ))}
        </div>
      </Card>

      <Card title="Poziții" padded={false}>
        <Table columns={columns} rows={inv} rowKey={(i) => i.id} />
      </Card>
      <p className="text-[11px] text-ink-faint">Asistentul AI nu oferă recomandări de investiții; pentru consiliere, discută cu un specialist ING.</p>
    </div>
  );
}
