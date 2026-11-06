"use client";

import { useMemo, useState } from "react";
import type { Transfer } from "@/lib/types";
import { useBank } from "@/lib/ui/bank-store";
import { fmtDate, fmtDateTime, fmtMoney, maskIban } from "@/lib/ui/format";
import { TRANSFER_STATUS } from "@/lib/ui/labels";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

interface LocalTransfer {
  id: string;
  from: string;
  toName: string;
  toIban: string;
  amount: number;
  currency: string;
  details: string;
  ts: string;
}

const SCHEME: Record<Transfer["scheme"], string> = { intra: "Intrabancar", SEPA: "SEPA", SWIFT: "SWIFT", instant: "Instant" };

export default function PaymentsPage() {
  const { data, loading } = useBank();
  const toast = useToast();
  const [fromId, setFromId] = useState("");
  const [benef, setBenef] = useState("manual");
  const [toName, setToName] = useState("");
  const [toIban, setToIban] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [recent, setRecent] = useState<LocalTransfer[]>([]);

  const from = useMemo(() => data?.accounts.find((a) => a.id === (fromId || data.accounts[0]?.id)), [data, fromId]);
  const amt = Number(amount.replace(",", ".")) || 0;
  const errors: string[] = [];
  if (step === "confirm" || amount) {
    if (amt <= 0) errors.push("Suma trebuie să fie pozitivă.");
    if (from && amt > from.available) errors.push("Suma depășește disponibilul contului.");
  }
  const ibanOk = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(toIban.replace(/\s/g, "").toUpperCase());

  if (loading || !data) return <PageSkeleton />;

  const pickBenef = (id: string) => {
    setBenef(id);
    const b = data.beneficiaries.find((x) => x.id === id);
    if (b) {
      setToName(b.name);
      setToIban(b.iban);
    } else {
      setToName("");
      setToIban("");
    }
  };
  const canContinue = from && amt > 0 && amt <= from.available && toName.trim() && ibanOk;
  const confirm = () => {
    if (!from) return;
    setRecent((xs) => [
      { id: `loc_${Date.now().toString(36)}`, from: from.name, toName, toIban, amount: amt, currency: from.currency, details, ts: new Date().toISOString() },
      ...xs,
    ]);
    toast.success("Transfer inițiat", `${fmtMoney(amt, from.currency)} către ${toName} (simulare, fără scriere în core banking)`);
    setStep("form");
    setAmount("");
    setDetails("");
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Plăți" subtitle="Transfer nou, beneficiari și istoricul transferurilor" />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="Transfer nou" subtitle={step === "form" ? "Pasul 1 din 2 · detalii" : "Pasul 2 din 2 · confirmare"} className="lg:col-span-3">
          {step === "form" ? (
            <div className="space-y-3">
              <Field label="Din cont" hint={from ? `disponibil ${fmtMoney(from.available, from.currency)}` : undefined}>
                <Select value={from?.id ?? ""} onChange={(e) => setFromId(e.target.value)}>
                  {data.accounts
                    .filter((a) => a.type === "current")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} · {fmtMoney(a.balance, a.currency)}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Către beneficiar">
                <Select value={benef} onChange={(e) => pickBenef(e.target.value)}>
                  <option value="manual">IBAN nou…</option>
                  {data.beneficiaries.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.bank}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nume beneficiar">
                  <Input value={toName} onChange={(e) => setToName(e.target.value)} disabled={benef !== "manual"} />
                </Field>
                <Field label="IBAN" hint={toIban && !ibanOk ? <span className="text-danger">format invalid</span> : undefined}>
                  <Input value={toIban} onChange={(e) => setToIban(e.target.value)} disabled={benef !== "manual"} className="font-mono" placeholder="RO00XXXX0000…" />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={`Sumă (${from?.currency ?? "RON"})`}>
                  <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" />
                </Field>
                <Field label="Detalii plată">
                  <Input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="ex. Chirie noiembrie" />
                </Field>
              </div>
              {errors.map((e) => (
                <p key={e} className="text-xs text-danger">
                  {e}
                </p>
              ))}
              <div className="pt-1">
                <Button disabled={!canContinue} onClick={() => setStep("confirm")}>
                  Continuă
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-surface p-4">
                <p className="text-xs text-ink-muted">Transferi</p>
                <Money amount={amt} currency={from?.currency ?? "RON"} size="xl" />
                <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                  <dt className="text-ink-muted">Din</dt>
                  <dd>{from?.name}</dd>
                  <dt className="text-ink-muted">Către</dt>
                  <dd>{toName}</dd>
                  <dt className="text-ink-muted">IBAN</dt>
                  <dd className="font-mono text-xs">{maskIban(toIban.toUpperCase())}</dd>
                  <dt className="text-ink-muted">Detalii</dt>
                  <dd>{details || "—"}</dd>
                  <dt className="text-ink-muted">Comision</dt>
                  <dd>0,00 {from?.currency}</dd>
                  <dt className="text-ink-muted">Execuție</dt>
                  <dd>{from?.currency === "EUR" ? "SEPA, următoarea zi lucrătoare" : "Instant"}</dd>
                </dl>
              </div>
              <p className="text-xs text-ink-muted">Confirmarea este deterministă: nu implică modelul AI și nu scrie în mock-ul de core banking.</p>
              <div className="flex gap-2">
                <Button onClick={confirm}>Confirmă transferul</Button>
                <Button variant="secondary" onClick={() => setStep("form")}>
                  Înapoi
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card title="Beneficiari salvați">
            <ul className="divide-y divide-line/60 text-sm">
              {data.beneficiaries.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.name}</p>
                    <p className="truncate font-mono text-[11px] text-ink-muted">{maskIban(b.iban)}</p>
                  </div>
                  <button type="button" onClick={() => pickBenef(b.id)} className="shrink-0 text-xs font-semibold text-ing-orange-dark hover:underline cursor-pointer">
                    Alege
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Transferuri recente" subtitle="Inițiate în această sesiune (local)">
            {recent.length === 0 ? (
              <p className="text-sm text-ink-muted">Niciun transfer inițiat încă.</p>
            ) : (
              <ul className="divide-y divide-line/60 text-sm">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">{r.toName}</p>
                      <p className="text-[11px] text-ink-muted">
                        {fmtDateTime(r.ts)} · {r.details || "fără detalii"}
                      </p>
                    </div>
                    <div className="text-right">
                      <Money amount={-r.amount} currency={r.currency} signed size="sm" />
                      <div>
                        <Badge tone="info">Inițiat</Badge>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card title="Istoric transferuri" subtitle="Din core banking (mock)" padded={false}>
        <div className="divide-y divide-line/60">
          {data.transfers.map((t) => {
            const st = TRANSFER_STATUS[t.status];
            return (
              <div key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.toName}</p>
                  <p className="text-[11px] text-ink-muted">
                    {fmtDateTime(t.initiated)} · {SCHEME[t.scheme]} · {t.reference} · <span className="font-mono">{t.id}</span>
                  </p>
                  {t.status === "rejected" && t.rejectReason && <p className="mt-0.5 text-xs text-danger">Motiv: {t.rejectReason}</p>}
                  {t.status === "pending_aml" && t.eta && <p className="mt-0.5 text-xs text-warning">Verificare AML în curs · estimat {fmtDate(t.eta)}</p>}
                </div>
                <Badge tone={st.tone} dot>
                  {st.label}
                </Badge>
                <Money amount={-t.amount} currency={t.currency} signed size="sm" className="w-28 text-right" />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
