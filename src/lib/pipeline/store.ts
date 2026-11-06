/**
 * Step 8a — Conversation Store: in-memory Map + JSON file at .data/turns.json
 * so restarts keep history. Everything stored is pseudonymized.
 */
import fs from "node:fs";
import path from "node:path";
import type { Branch, JudgeScore, OpsSummary, StoredTurn } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "turns.json");

const turns = new Map<string, StoredTurn>();
let loaded = false;
let writeChain: Promise<void> = Promise.resolve();

function load() {
  if (loaded) return;
  loaded = true;
  try {
    if (fs.existsSync(FILE)) {
      const arr = JSON.parse(fs.readFileSync(FILE, "utf8")) as StoredTurn[];
      for (const t of arr) turns.set(t.turnId, t);
    }
  } catch (err) {
    console.warn("[store] nu am putut citi .data/turns.json:", err instanceof Error ? err.message : err);
  }
}

function persist() {
  const snapshot = JSON.stringify(list(), null, 1);
  writeChain = writeChain.then(async () => {
    try {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
      await fs.promises.writeFile(FILE, snapshot, "utf8");
    } catch (err) {
      console.warn("[store] nu am putut scrie .data/turns.json:", err instanceof Error ? err.message : err);
    }
  });
  return writeChain;
}

export function saveTurn(turn: StoredTurn): StoredTurn {
  load();
  turns.set(turn.turnId, turn);
  void persist();
  return turn;
}

export function getTurn(turnId: string): StoredTurn | undefined {
  load();
  return turns.get(turnId);
}

/** Newest first. */
export function list(): StoredTurn[] {
  load();
  return [...turns.values()].sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

export function setJudges(turnId: string, judges: JudgeScore[]): StoredTurn | undefined {
  load();
  const t = turns.get(turnId);
  if (!t) return undefined;
  t.judges = judges;
  t.judgedAt = new Date().toISOString();
  void persist();
  return t;
}

export async function reset(): Promise<void> {
  load();
  turns.clear();
  await persist();
}

export function flush(): Promise<void> {
  return writeChain;
}

export function summary(): OpsSummary {
  const all = list();
  const byBranch: Record<Branch, number> = { ACTION: 0, ACCOUNT_QA: 0, GENERAL_QA: 0, HUMAN: 0, BLOCKED: 0 };
  const byModel: Record<string, { turns: number; totalMs: number }> = {};
  const judgeSums: Record<JudgeScore["judge"], { sum: number; n: number }> = {
    faithfulness: { sum: 0, n: 0 },
    hallucination: { sum: 0, n: 0 },
    guardrails: { sum: 0, n: 0 },
    resolution: { sum: 0, n: 0 },
    tone: { sum: 0, n: 0 },
  };
  let totalMs = 0;
  let fallback = 0;
  for (const t of all) {
    byBranch[t.branch] = (byBranch[t.branch] ?? 0) + 1;
    totalMs += t.totalMs;
    if (t.fallbackUsed) fallback++;
    const m = t.model ?? "n/a";
    const bm = (byModel[m] ??= { turns: 0, totalMs: 0 });
    bm.turns++;
    bm.totalMs += t.totalMs;
    for (const j of t.judges ?? []) {
      judgeSums[j.judge].sum += j.score;
      judgeSums[j.judge].n++;
    }
  }
  const n = all.length;
  const avgJudge = Object.fromEntries(Object.entries(judgeSums).map(([k, v]) => [k, v.n ? Math.round((v.sum / v.n) * 100) / 100 : 0])) as OpsSummary["avgJudge"];
  return {
    turns: n,
    byBranch,
    avgLatencyMs: n ? Math.round(totalMs / n) : 0,
    fallbackRate: n ? Math.round((fallback / n) * 100) / 100 : 0,
    escalationRate: n ? Math.round((byBranch.HUMAN / n) * 100) / 100 : 0,
    blockedRate: n ? Math.round((byBranch.BLOCKED / n) * 100) / 100 : 0,
    avgJudge,
    byModel: Object.fromEntries(Object.entries(byModel).map(([k, v]) => [k, { turns: v.turns, avgLatencyMs: Math.round(v.totalMs / v.turns) }])),
  };
}
