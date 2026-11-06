"use client";

import { useBank } from "@/lib/ui/bank-store";
import { fmtDate, fmtMoney } from "@/lib/ui/format";
import type { Insurance } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { IconShield } from "@/components/ui/Icons";

const DESC: Record<Insurance["type"], string> = {
  life: "Protecție financiară pentru familie în caz de deces sau invaliditate permanentă.",
  health: "Acces la servicii medicale private, spitalizare și intervenții chirurgicale.",
  income: "Îți acoperă o parte din venit dacă nu mai poți lucra din motive medicale.",
};

export default function InsurancePage() {
  const { data, loading } = useBank();
  if (loading || !data) return <PageSkeleton />;
  const monthly = data.insurance.reduce((s, i) => s + (i.frequency === "monthly" ? i.premium : i.premium / 12), 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Asigurări" subtitle={`Prime lunare totale ${fmtMoney(monthly, "RON")} · încheiate prin ING, emise de partener`} />
      <div className="grid gap-4 md:grid-cols-3">
        {data.insurance.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ing-orange-soft text-ing-orange">
                <IconShield size={20} />
              </span>
              <Badge tone={p.status === "active" ? "success" : "danger"} dot>
                {p.status === "active" ? "Activă" : "Expirată"}
              </Badge>
            </div>
            <h2 className="mt-3 text-base font-semibold">{p.name}</h2>
            <p className="text-xs text-ink-muted">
              {p.insurer} · din {fmtDate(p.since)}
            </p>
            <p className="mt-2 text-sm text-ink-muted">{DESC[p.type]}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-baseline justify-between">
                <dt className="text-ink-muted">Sumă asigurată</dt>
                <dd>
                  <Money amount={p.coverage} currency={p.currency} decimals={0} />
                </dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-ink-muted">Primă {p.frequency === "monthly" ? "lunară" : "anuală"}</dt>
                <dd className="font-semibold">{fmtMoney(p.premium, p.currency)}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-ink-muted">Următoarea plată</dt>
                <dd>{fmtDate(p.nextPaymentDate)}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
    </div>
  );
}
