"use client";

import { useState } from "react";
import { STEP_LABELS, STEP_ORDER, type JudgeScore, type StoredTurn, type TraceStep } from "@/lib/types";
import { fmtMs, fmtTime } from "@/lib/ui/format";
import { BRANCH, INTENT, STEP_STATUS } from "@/lib/ui/labels";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconChevron } from "@/components/ui/Icons";
import { JsonViewer } from "@/components/chat/JsonViewer";

const verdictTone: Record<JudgeScore["verdict"], Tone> = { pass: "success", warn: "warning", fail: "danger" };
const JUDGE_LABEL: Record<JudgeScore["judge"], string> = {
  faithfulness: "fidelitate",
  hallucination: "halucinare",
  guardrails: "guardrails",
  resolution: "rezolvare",
  tone: "ton",
};
const stepTone: Record<TraceStep["status"], Tone> = { pending: "neutral", running: "info", ok: "success", blocked: "danger", skipped: "neutral", error: "danger" };

export function JudgeChips({ judges }: { judges?: JudgeScore[] }) {
  if (!judges || judges.length === 0) return <span className="text-xs text-ink-faint">neevaluat</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {judges.map((j) => (
        <Badge key={j.judge} tone={verdictTone[j.verdict]} className="normal-case">
          {JUDGE_LABEL[j.judge]} {Math.round(j.score * 100)}
        </Badge>
      ))}
    </span>
  );
}

export function TurnRow({ turn, onJudge, judging }: { turn: StoredTurn; onJudge: (id: string) => void; judging: boolean }) {
  const [open, setOpen] = useState(false);
  const br = BRANCH[turn.branch] ?? { label: turn.branch, tone: "neutral" as Tone };
  const stepsByKey = new Map(turn.steps.map((s) => [s.key, s]));
  return (
    <>
      <tr className={`border-b border-line/70 text-sm hover:bg-surface cursor-pointer ${open ? "bg-surface" : ""}`} onClick={() => setOpen((o) => !o)}>
        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-ink-muted">{fmtTime(turn.ts)}</td>
        <td className="px-3 py-2">
          <Badge tone={br.tone}>{br.label}</Badge>
        </td>
        <td className="px-3 py-2 text-xs">
          {INTENT[turn.intent] ?? turn.intent}
          <span className="ml-1 text-ink-faint">({Math.round(turn.routerConfidence * 100)}%)</span>
        </td>
        <td className="px-3 py-2 max-w-[260px] truncate text-xs text-ink-muted" title={turn.userMessage}>
          {turn.userMessage}
        </td>
        <td className="px-3 py-2 font-mono text-xs">
          {turn.model ?? "—"}
          {turn.fallbackUsed && (
            <Badge tone="warning" className="ml-1">
              fallback
            </Badge>
          )}
        </td>
        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{fmtMs(turn.totalMs)}</td>
        <td className="px-3 py-2">
          <JudgeChips judges={turn.judges} />
        </td>
        <td className="px-3 py-2 text-right">
          <IconChevron size={16} className={`inline text-ink-faint transition-transform ${open ? "rotate-180" : ""}`} />
        </td>
      </tr>
      {open && (
        <tr className="border-b border-line bg-surface/60">
          <td colSpan={8} className="px-4 py-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Mesaj (pseudonimizat)</p>
                  <p className="mt-1 rounded-lg bg-white px-3 py-2 text-sm">{turn.userMessage}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Răspuns (pseudonimizat)</p>
                  <p className="mt-1 whitespace-pre-wrap rounded-lg bg-white px-3 py-2 text-sm">{turn.assistantMessage || "—"}</p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                  <span>
                    turn <span className="font-mono">{turn.turnId}</span>
                  </span>
                  <span>
                    sesiune <span className="font-mono">{turn.sessionId.slice(0, 8)}…</span>
                  </span>
                  <span>prompt {turn.promptVersion}</span>
                  {turn.contextSchema && <span>schema {turn.contextSchema}</span>}
                  {turn.judgedAt && <span>evaluat {fmtTime(turn.judgedAt)}</span>}
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Judges</p>
                    <Button size="sm" variant="secondary" loading={judging} onClick={(e) => { e.stopPropagation(); onJudge(turn.turnId); }}>
                      {turn.judges?.length ? "Re-evaluează" : "Rulează judges"}
                    </Button>
                  </div>
                  {turn.judges?.length ? (
                    <ul className="mt-2 space-y-1 text-xs">
                      {turn.judges.map((j) => (
                        <li key={j.judge} className="flex items-start gap-2 rounded-lg bg-white px-3 py-1.5">
                          <Badge tone={verdictTone[j.verdict]}>{JUDGE_LABEL[j.judge]}</Badge>
                          <span className="font-mono">{j.score.toFixed(2)}</span>
                          <span className="text-ink-muted">{j.note}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-ink-faint">Nu a fost evaluată încă.</p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Context pack (pseudonimizat)</p>
                  {turn.contextPack ? <JsonViewer value={turn.contextPack} className="mt-1 max-h-72 overflow-auto hb-scroll" /> : <p className="mt-1 text-xs text-ink-faint">Fără context (ramura nu a cerut date).</p>}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Pașii pipeline-ului</p>
                <ol className="mt-1 space-y-1.5">
                  {STEP_ORDER.map((k) => {
                    const s = stepsByKey.get(k);
                    const meta = STEP_LABELS[k];
                    return (
                      <li key={k} className="rounded-lg bg-white px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">
                            {meta.n}. {meta.title}
                          </span>
                          <span className="flex items-center gap-2">
                            {s?.durationMs !== undefined && <span className="font-mono text-ink-muted">{fmtMs(s.durationMs)}</span>}
                            <Badge tone={stepTone[s?.status ?? "pending"]}>{STEP_STATUS[s?.status ?? "pending"]}</Badge>
                          </span>
                        </div>
                        {s?.summary && <p className="mt-0.5 text-ink-muted">{s.summary}</p>}
                        {s?.details && Object.keys(s.details).length > 0 && <StepDetails details={s.details} />}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function StepDetails({ details }: { details: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-[11px] font-semibold text-ing-orange-dark hover:underline cursor-pointer">
        {open ? "ascunde detaliile" : "detalii"}
      </button>
      {open && <JsonViewer value={details} className="mt-1" />}
    </>
  );
}
