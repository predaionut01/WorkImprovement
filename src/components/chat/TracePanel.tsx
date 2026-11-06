"use client";

import { useState } from "react";
import { STEP_LABELS, STEP_ORDER, type StepStatus, type TraceStep } from "@/lib/types";
import { fmtMs } from "@/lib/ui/format";
import { STEP_STATUS } from "@/lib/ui/labels";
import { IconAlert, IconCheck, IconChevron, IconLock, IconMinus, IconSpinner } from "@/components/ui/Icons";
import { JsonViewer } from "./JsonViewer";
import type { TraceState } from "./types";

function StatusIcon({ status, n }: { status: StepStatus; n: number }) {
  const base = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold";
  switch (status) {
    case "running":
      return (
        <span className={`${base} bg-ing-orange-soft text-ing-orange`}>
          <IconSpinner size={16} />
        </span>
      );
    case "ok":
      return (
        <span className={`${base} bg-success text-white`}>
          <IconCheck size={14} />
        </span>
      );
    case "blocked":
      return (
        <span className={`${base} bg-danger text-white`}>
          <IconLock size={14} />
        </span>
      );
    case "error":
      return (
        <span className={`${base} bg-danger text-white`}>
          <IconAlert size={14} />
        </span>
      );
    case "skipped":
      return (
        <span className={`${base} border-2 border-dashed border-ink-faint text-ink-faint`}>
          <IconMinus size={12} />
        </span>
      );
    default:
      return <span className={`${base} border border-line bg-white text-ink-faint`}>{n}</span>;
  }
}

const rowTone: Record<StepStatus, string> = {
  pending: "text-ink-faint",
  running: "text-ink",
  ok: "text-ink",
  blocked: "text-danger",
  error: "text-danger",
  skipped: "text-ink-faint",
};

function StepRow({ step, last }: { step: TraceStep; last: boolean }) {
  const [open, setOpen] = useState(false);
  const meta = STEP_LABELS[step.key];
  const hasDetails = step.details && Object.keys(step.details).length > 0;
  const running = step.status === "running";
  return (
    <li className="relative flex gap-3">
      {!last && <span className="absolute left-[13px] top-7 h-[calc(100%-12px)] w-px bg-line" aria-hidden />}
      <StatusIcon status={step.status} n={meta.n} />
      <div className={`min-w-0 flex-1 pb-4 ${rowTone[step.status]}`}>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold leading-tight">
            {meta.title}
            <span className="ml-2 text-[10px] font-medium uppercase tracking-wide opacity-70">{STEP_STATUS[step.status]}</span>
          </p>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-muted">
            {step.durationMs !== undefined ? fmtMs(step.durationMs) : running ? "…" : ""}
          </span>
        </div>
        <p className="text-[11px] text-ink-muted">{meta.short}</p>
        {step.summary && <p className={`mt-1 text-xs leading-snug ${step.status === "blocked" || step.status === "error" ? "text-danger" : "text-ink"}`}>{step.summary}</p>}
        {hasDetails && (
          <>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-ing-orange-dark hover:underline cursor-pointer"
            >
              <IconChevron size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
              {open ? "ascunde detaliile" : "detalii"}
            </button>
            {open && <JsonViewer value={step.details} className="mt-1.5" />}
          </>
        )}
      </div>
    </li>
  );
}

export function TracePanel({ trace, busy, turnId, totalMs }: { trace: TraceState; busy: boolean; turnId: string | null; totalMs?: number }) {
  const anyStarted = STEP_ORDER.some((k) => trace[k].status !== "pending");
  const finished = !busy && anyStarted;
  const sumMs = STEP_ORDER.reduce((a, k) => a + (trace[k].durationMs ?? 0), 0);
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Trace pipeline</h3>
          <span className={`text-[11px] font-semibold ${busy ? "text-ing-orange" : finished ? "text-success" : "text-ink-faint"}`}>
            {busy ? "în lucru…" : finished ? `finalizat · ${fmtMs(totalMs ?? sumMs)}` : "în așteptare"}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          {turnId ? (
            <>
              tură <span className="font-mono">{turnId}</span>
            </>
          ) : (
            "Cei 8 pași prin care trece fiecare mesaj, în timp real."
          )}
        </p>
      </header>
      <ol className="flex-1 overflow-y-auto hb-scroll px-4 pt-4">
        {STEP_ORDER.map((k, i) => (
          <StepRow key={k} step={trace[k]} last={i === STEP_ORDER.length - 1} />
        ))}
      </ol>
      {!anyStarted && (
        <p className="border-t border-line px-4 py-2 text-[11px] text-ink-faint">
          Trimite un mesaj sau alege un exemplu. Fiecare pas se colorează pe măsură ce rulează: verde = ok, roșu = blocat, gri întrerupt = sărit.
        </p>
      )}
    </div>
  );
}
