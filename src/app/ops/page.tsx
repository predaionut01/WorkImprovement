"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Branch, JudgeScore, OpsSummary, StoredTurn } from "@/lib/types";
import { fmtMs, fmtPct } from "@/lib/ui/format";
import { BRANCH } from "@/lib/ui/labels";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { IconPlay, IconRefresh, IconTrash } from "@/components/ui/Icons";
import { TurnRow } from "@/components/ops/TurnRow";

type Status = "ok" | "missing" | "error";
const BRANCHES: Branch[] = ["ACTION", "ACCOUNT_QA", "GENERAL_QA", "HUMAN", "BLOCKED"];
const JUDGES: JudgeScore["judge"][] = ["faithfulness", "hallucination", "guardrails", "resolution", "tone"];
const JUDGE_LABEL: Record<JudgeScore["judge"], string> = { faithfulness: "Fidelitate", hallucination: "Halucinare", guardrails: "Guardrails", resolution: "Rezolvare", tone: "Ton" };

async function getJson<T>(url: string): Promise<{ status: Status; data: T | null; message?: string }> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (r.status === 404) return { status: "missing", data: null };
    if (!r.ok) return { status: "error", data: null, message: `HTTP ${r.status}` };
    return { status: "ok", data: (await r.json()) as T };
  } catch (e) {
    return { status: "error", data: null, message: (e as Error).message };
  }
}

export default function OpsPage() {
  const toast = useToast();
  const [turns, setTurns] = useState<StoredTurn[]>([]);
  const [summary, setSummary] = useState<OpsSummary | null>(null);
  const [status, setStatus] = useState<Status | "loading">("loading");
  const [message, setMessage] = useState<string | undefined>();
  const [auto, setAuto] = useState(true);
  const [judging, setJudging] = useState<string | "all" | null>(null);
  const [busyReset, setBusyReset] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const [t, s] = await Promise.all([getJson<StoredTurn[]>("/api/ops/turns"), getJson<OpsSummary>("/api/ops/summary")]);
    if (t.status === "ok" && Array.isArray(t.data)) setTurns(t.data);
    if (s.status === "ok" && s.data) setSummary(s.data);
    const worst: Status = t.status === "ok" || s.status === "ok" ? "ok" : t.status === "missing" && s.status === "missing" ? "missing" : "error";
    setStatus(worst);
    setMessage(t.message ?? s.message);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);
  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => void load(), 5000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [auto, load]);

  const runJudges = useCallback(
    async (turnId?: string) => {
      setJudging(turnId ?? "all");
      try {
        const r = await fetch("/api/ops/judge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(turnId ? { turnId } : {}) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const updated = (await r.json()) as StoredTurn[];
        if (Array.isArray(updated)) {
          setTurns((cur) => {
            const map = new Map(cur.map((t) => [t.turnId, t]));
            for (const u of updated) map.set(u.turnId, u);
            return [...map.values()].sort((a, b) => (a.ts < b.ts ? 1 : -1));
          });
        }
        toast.success("Judges rulate", `${Array.isArray(updated) ? updated.length : 0} ture evaluate`);
        void load();
      } catch (e) {
        toast.error("Judges indisponibile", (e as Error).message);
      } finally {
        setJudging(null);
      }
    },
    [load, toast],
  );

  const reset = useCallback(async () => {
    if (!window.confirm("Ștergi toate turele din Conversation Store?")) return;
    setBusyReset(true);
    try {
      const r = await fetch("/api/ops/reset", { method: "POST" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setTurns([]);
      setSummary(null);
      toast.success("Store resetat");
      void load();
    } catch (e) {
      toast.error("Reset eșuat", (e as Error).message);
    } finally {
      setBusyReset(false);
    }
  }, [load, toast]);

  const unjudged = useMemo(() => turns.filter((t) => !t.judges || t.judges.length === 0).length, [turns]);
  const totalBranch = summary ? BRANCHES.reduce((s, b) => s + (summary.byBranch?.[b] ?? 0), 0) : 0;
  const models = summary ? Object.entries(summary.byModel ?? {}) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Observabilitate chat</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Conversation Store, metrici și judges pentru pipeline-ul asistentului ·{" "}
            <Link href="/" className="font-semibold text-ing-orange-dark hover:underline">
              înapoi la Home&apos;Bank
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle size="sm" checked={auto} onChange={setAuto} label="Auto-refresh 5s" />
          <Button size="sm" variant="secondary" icon={<IconRefresh size={14} />} onClick={() => void load()}>
            Reîncarcă
          </Button>
          <Button size="sm" icon={<IconPlay size={14} />} loading={judging === "all"} disabled={unjudged === 0 || judging !== null} onClick={() => void runJudges()}>
            Rulează judges {unjudged > 0 ? `(${unjudged})` : ""}
          </Button>
          <Button size="sm" variant="danger" icon={<IconTrash size={14} />} loading={busyReset} onClick={() => void reset()}>
            Reset
          </Button>
        </div>
      </div>

      {status === "missing" && (
        <Card className="border-warning/50">
          <p className="text-sm">
            <strong>Backend-ul /api/ops nu răspunde încă</strong> (404). Pagina se va popula automat când pipeline-ul este disponibil și există ture în store.
          </p>
        </Card>
      )}
      {status === "error" && (
        <Card className="border-danger/50">
          <p className="text-sm text-danger">Eroare la încărcare: {message}</p>
        </Card>
      )}

      {/* summary tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Ture" value={summary?.turns ?? turns.length} hint={lastRefresh ? `actualizat ${lastRefresh.toLocaleTimeString("ro-RO")}` : undefined} />
        <Stat label="Latență medie" value={summary ? fmtMs(summary.avgLatencyMs) : "—"} />
        <Stat label="Rată fallback" value={summary ? fmtPct(summary.fallbackRate * 100, 1) : "—"} hint="provider secundar" />
        <Stat label="Rată escaladare" value={summary ? fmtPct(summary.escalationRate * 100, 1) : "—"} hint="către agent uman" />
        <Stat label="Rată blocare" value={summary ? fmtPct(summary.blockedRate * 100, 1) : "—"} hint="input / output guard" />
        <div className="rounded-card border border-line bg-white px-4 py-3 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Ramuri</p>
          {summary && totalBranch > 0 ? (
            <>
              <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
                {BRANCHES.map((b) => (
                  <div key={b} style={{ width: `${((summary.byBranch?.[b] ?? 0) / totalBranch) * 100}%` }} className={branchBar[b]} title={`${BRANCH[b].label}: ${summary.byBranch?.[b] ?? 0}`} />
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-ink-muted">
                {BRANCHES.map((b) => (
                  <span key={b}>
                    {BRANCH[b].label} {summary.byBranch?.[b] ?? 0}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-1 text-xl font-bold">—</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Per model" subtitle="Ture și latență medie" padded={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-2 font-semibold">Model</th>
                <th className="px-4 py-2 text-right font-semibold">Ture</th>
                <th className="px-4 py-2 text-right font-semibold">Latență medie</th>
              </tr>
            </thead>
            <tbody>
              {models.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-ink-muted">
                    Niciun model încă.
                  </td>
                </tr>
              )}
              {models.map(([m, v]) => (
                <tr key={m} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{m}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{v.turns}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">{fmtMs(v.avgLatencyMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Scor mediu judges" subtitle="0–100, mai mare = mai bine">
          {summary ? (
            <ul className="space-y-2">
              {JUDGES.map((j) => {
                const v = summary.avgJudge?.[j];
                const pct = typeof v === "number" ? v * 100 : null;
                return (
                  <li key={j} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
                    <span>{JUDGE_LABEL[j]}</span>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <div className={`h-full rounded-full ${pct === null ? "" : pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-danger"}`} style={{ width: `${pct ?? 0}%` }} />
                    </div>
                    <span className="w-10 text-right font-mono text-xs tabular-nums">{pct === null ? "—" : Math.round(pct)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Fără date.</p>
          )}
        </Card>
      </div>

      <Card title="Conversation Store" subtitle={`${turns.length} ture · cele mai noi primele · click pe un rând pentru context pack și pașii pipeline-ului`} padded={false}>
        <div className="overflow-x-auto hb-scroll">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-muted">
                <th className="px-3 py-2 font-semibold">Ora</th>
                <th className="px-3 py-2 font-semibold">Ramură</th>
                <th className="px-3 py-2 font-semibold">Intenție (încredere)</th>
                <th className="px-3 py-2 font-semibold">Mesaj</th>
                <th className="px-3 py-2 font-semibold">Model</th>
                <th className="px-3 py-2 text-right font-semibold">Latență</th>
                <th className="px-3 py-2 font-semibold">Judges</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {turns.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-ink-muted">
                    Nicio tură salvată. Trimite un mesaj din asistentul Home&apos;Bank și revino aici.
                  </td>
                </tr>
              )}
              {turns.map((t) => (
                <TurnRow key={t.turnId} turn={t} onJudge={(id) => void runJudges(id)} judging={judging === t.turnId || judging === "all"} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-[11px] text-ink-faint">
        Toate mesajele și context pack-urile din store sunt pseudonimizate (<Badge tone="neutral">&lt;IBAN_01&gt;</Badge> etc.). Datele sunt fictive.
      </p>
    </div>
  );
}

const branchBar: Record<Branch, string> = {
  ACTION: "bg-info",
  ACCOUNT_QA: "bg-success",
  GENERAL_QA: "bg-ink-faint",
  HUMAN: "bg-warning",
  BLOCKED: "bg-danger",
};
