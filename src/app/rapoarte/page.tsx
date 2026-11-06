"use client";

import { useEffect, useMemo, useState } from "react";
import type { MonthlyStat } from "@/lib/types";
import { CUSTOMER_ID } from "@/lib/ui/bank-store";
import { fmtMoney, fmtMonth } from "@/lib/ui/format";
import { CATEGORY_COLORS } from "@/lib/ui/labels";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { Select } from "@/components/ui/Field";

export default function ReportsPage() {
  const [stats, setStats] = useState<MonthlyStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<string>("");

  useEffect(() => {
    let alive = true;
    fetch("/api/bank/stats?months=6", { headers: { "x-customer-id": CUSTOMER_ID }, cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`stats ${r.status}`);
        return (await r.json()) as MonthlyStat[];
      })
      .then((s) => {
        if (!alive) return;
        setStats(s);
        setMonth((m) => m || s[0]?.month || "");
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const sel = useMemo(() => stats?.find((s) => s.month === month) ?? stats?.[0], [stats, month]);
  const maxBar = useMemo(() => Math.max(1, ...(stats ?? []).flatMap((s) => [s.income, s.spend])), [stats]);

  if (error) return <Card title="Rapoarte"><p className="text-sm text-danger">{error}</p></Card>;
  if (!stats || !sel) return <PageSkeleton />;

  const months = [...stats].reverse(); // chronological
  const maxCat = Math.max(1, ...sel.byCategory.map((c) => c.amount));
  const net = sel.income - sel.spend;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rapoarte"
        subtitle="Venituri și cheltuieli pe Contul Curent RON"
        action={
          <Select value={sel.month} onChange={(e) => setMonth(e.target.value)} className="w-52">
            {stats.map((s) => (
              <option key={s.month} value={s.month}>
                {fmtMonth(s.month)}
              </option>
            ))}
          </Select>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Venituri · {fmtMonth(sel.month)}</p>
          <Money amount={sel.income} currency="RON" size="xl" className="mt-1 block text-success" />
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Cheltuieli</p>
          <Money amount={sel.spend} currency="RON" size="xl" className="mt-1 block" />
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Diferență</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${net >= 0 ? "text-success" : "text-danger"}`}>{fmtMoney(net, "RON", { sign: true })}</p>
        </Card>
      </div>

      <Card title="Venituri vs. cheltuieli" subtitle="Ultimele 6 luni · click pe o lună pentru detalii">
        <svg viewBox={`0 0 ${months.length * 90} 200`} className="h-56 w-full" role="img" aria-label="Venituri și cheltuieli lunare">
          {months.map((s, i) => {
            const x = i * 90;
            const hi = (s.income / maxBar) * 150;
            const hs = (s.spend / maxBar) * 150;
            const active = s.month === sel.month;
            return (
              <g key={s.month} onClick={() => setMonth(s.month)} className="cursor-pointer">
                <rect x={x} y={0} width={90} height={200} fill={active ? "#fff1e8" : "transparent"} rx={8} />
                <rect x={x + 18} y={170 - hi} width={22} height={hi} rx={3} fill="#2e8b57" />
                <rect x={x + 48} y={170 - hs} width={22} height={hs} rx={3} fill="#ff6200" />
                <text x={x + 45} y={190} textAnchor="middle" fontSize="11" fill={active ? "#e05600" : "#6b6b6b"} fontWeight={active ? 700 : 500}>
                  {fmtMonth(s.month).slice(0, 3)} {s.month.slice(2, 4)}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex gap-4 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-success" /> Venituri
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-ing-orange" /> Cheltuieli
          </span>
        </div>
      </Card>

      <Card title={`Cheltuieli pe categorii · ${fmtMonth(sel.month)}`} subtitle={`${sel.byCategory.reduce((s, c) => s + c.count, 0)} tranzacții`}>
        <ul className="space-y-2.5">
          {sel.byCategory.map((c) => (
            <li key={c.category} className="grid grid-cols-[150px_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate">{c.category}</span>
              <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full" style={{ width: `${(c.amount / maxCat) * 100}%`, background: CATEGORY_COLORS[c.category] }} />
              </div>
              <span className="w-36 text-right tabular-nums">
                {fmtMoney(c.amount, "RON")} <span className="text-xs text-ink-muted">({c.count})</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
