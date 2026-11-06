"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { STEP_ORDER, type ChatMessage, type ChatRequest, type ChatStreamEvent, type StepKey } from "@/lib/types";
import { newSessionId, streamChat } from "@/lib/ui/chat-client";
import { CUSTOMER_ID } from "@/lib/ui/bank-store";
import type { ChatItem, TraceState } from "./types";

const SESSION_KEY = "hb.chat.sessionId";
const HISTORY_MAX = 20;

export function emptyTrace(): TraceState {
  return Object.fromEntries(STEP_ORDER.map((k) => [k, { key: k, status: "pending" as const }])) as TraceState;
}

function readSession(): string {
  try {
    const s = window.sessionStorage.getItem(SESSION_KEY);
    if (s) return s;
  } catch {
    /* private mode etc. */
  }
  return rotateSession();
}
function rotateSession(): string {
  const id = newSessionId();
  try {
    window.sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    /* ignore */
  }
  return id;
}

export interface ChatController {
  items: ChatItem[];
  trace: TraceState;
  busy: boolean;
  sessionId: string;
  providerDown: boolean;
  setProviderDown: (v: boolean) => void;
  send: (text: string) => void;
  cancel: () => void;
  reset: () => void;
  /** mark an action item (confirm card / dismiss) */
  setActionState: (id: string, state: Extract<ChatItem, { kind: "action" }>["state"]) => void;
  pushSystem: (content: string, tone?: Extract<ChatItem, { kind: "system" }>["tone"]) => void;
  /** last turn metadata (for the Trace header) */
  lastTurnId: string | null;
  turnStartedAt: number | null;
}

export function useChat(): ChatController {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [trace, setTrace] = useState<TraceState>(emptyTrace);
  const [busy, setBusy] = useState(false);
  const [providerDown, setProviderDown] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [lastTurnId, setLastTurnId] = useState<string | null>(null);
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seq = useRef(0);
  const nextId = (p: string) => `${p}_${++seq.current}`;

  const pushSystem = useCallback<ChatController["pushSystem"]>((content, tone = "info") => {
    setItems((xs) => [...xs, { id: nextId("s"), kind: "system", content, tone, ts: Date.now() }]);
  }, []);

  const setActionState = useCallback<ChatController["setActionState"]>((id, state) => {
    setItems((xs) => xs.map((x) => (x.id === id && x.kind === "action" ? { ...x, state } : x)));
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setItems([]);
    setTrace(emptyTrace());
    setLastTurnId(null);
    setTurnStartedAt(null);
    setSessionId(rotateSession());
  }, []);

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      const sid = sessionId || readSession();
      if (!sessionId) setSessionId(sid);

      const history: ChatMessage[] = items
        .filter((x): x is Extract<ChatItem, { kind: "user" | "assistant" }> => (x.kind === "user" || x.kind === "assistant") && x.content.trim().length > 0)
        .map((x) => ({ role: x.kind, content: x.content }))
        .slice(-HISTORY_MAX);

      const userId = nextId("u");
      const asstId = nextId("a");
      const started = Date.now();
      setItems((xs) => [
        ...xs,
        { id: userId, kind: "user", content: text, ts: started },
        { id: asstId, kind: "assistant", content: "", streaming: true, ts: started },
      ]);
      setTrace(emptyTrace());
      setLastTurnId(null);
      setTurnStartedAt(started);
      setBusy(true);

      const ac = new AbortController();
      abortRef.current = ac;

      const req: ChatRequest = {
        sessionId: sid,
        customerId: CUSTOMER_ID,
        message: text,
        history,
        simulate: { providerDown },
      };

      const patchAssistant = (fn: (a: Extract<ChatItem, { kind: "assistant" }>) => Extract<ChatItem, { kind: "assistant" }>) =>
        setItems((xs) => xs.map((x) => (x.id === asstId && x.kind === "assistant" ? fn(x) : x)));

      const onEvent = (e: ChatStreamEvent) => {
        switch (e.type) {
          case "turn":
            setLastTurnId(e.turnId);
            patchAssistant((a) => ({ ...a, turnId: e.turnId }));
            break;
          case "trace":
            setTrace((t) => ({ ...t, [e.step.key]: { ...t[e.step.key as StepKey], ...e.step } }));
            break;
          case "token":
            patchAssistant((a) => ({ ...a, content: a.content + e.text }));
            break;
          case "action":
            setItems((xs) => [...xs, { id: nextId("x"), kind: "action", action: e.action, state: "open", ts: Date.now() }]);
            break;
          case "handover":
            setItems((xs) => [...xs, { id: nextId("s"), kind: "system", content: `Transfer către un coleg: ${e.reason}`, tone: "warning", ts: Date.now() }]);
            break;
          case "done":
            patchAssistant((a) => ({
              ...a,
              streaming: false,
              turnId: e.turnId,
              meta: { branch: e.branch, intent: e.intent, model: e.model, totalMs: e.totalMs },
            }));
            setLastTurnId(e.turnId);
            break;
          case "error":
            setItems((xs) => [...xs, { id: nextId("s"), kind: "system", content: e.message, tone: "error", ts: Date.now() }]);
            break;
        }
      };

      void streamChat(req, onEvent, ac.signal)
        .catch((err: unknown) => {
          const aborted = err instanceof DOMException && err.name === "AbortError";
          const msg = aborted ? "Răspuns oprit." : `Nu am putut contacta asistentul: ${(err as Error).message}`;
          setItems((xs) => [...xs, { id: nextId("s"), kind: "system", content: msg, tone: aborted ? "info" : "error", ts: Date.now() }]);
          if (!aborted) {
            setTrace((t) => {
              const running = STEP_ORDER.find((k) => t[k].status === "running") ?? "input_guard";
              return { ...t, [running]: { ...t[running], status: "error", summary: t[running].summary ?? "Conexiune întreruptă" } };
            });
          }
        })
        .finally(() => {
          // finalize: stop streaming; drop an assistant bubble that never received text
          setItems((xs) =>
            xs
              .map((x) => (x.id === asstId && x.kind === "assistant" ? { ...x, streaming: false } : x))
              .filter((x) => !(x.id === asstId && x.kind === "assistant" && x.content.trim() === "" && !x.meta)),
          );
          setBusy(false);
          abortRef.current = null;
        });
    },
    [busy, items, providerDown, sessionId],
  );

  return useMemo<ChatController>(
    () => ({ items, trace, busy, sessionId, providerDown, setProviderDown, send, cancel, reset, setActionState, pushSystem, lastTurnId, turnStartedAt }),
    [items, trace, busy, sessionId, providerDown, send, cancel, reset, setActionState, pushSystem, lastTurnId, turnStartedAt],
  );
}
