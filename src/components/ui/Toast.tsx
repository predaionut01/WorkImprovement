"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { IconAlert, IconCheck, IconClose } from "./Icons";

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}
interface ToastApi {
  push: (title: string, opts?: { body?: string; tone?: ToastTone; ttlMs?: number }) => void;
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const push = useCallback<ToastApi["push"]>(
    (title, opts) => {
      const id = ++seq.current;
      setItems((xs) => [...xs, { id, title, body: opts?.body, tone: opts?.tone ?? "info" }]);
      window.setTimeout(() => dismiss(id), opts?.ttlMs ?? 4500);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (t, b) => push(t, { body: b, tone: "success" }),
      error: (t, b) => push(t, { body: b, tone: "error", ttlMs: 7000 }),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-4 z-[90] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg hb-pop ${
              t.tone === "success" ? "border-success/40" : t.tone === "error" ? "border-danger/40" : "border-line"
            }`}
            role="status"
          >
            <span className={`mt-0.5 ${t.tone === "success" ? "text-success" : t.tone === "error" ? "text-danger" : "text-info"}`}>
              {t.tone === "error" ? <IconAlert size={18} /> : <IconCheck size={18} />}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{t.title}</p>
              {t.body && <p className="text-ink-muted text-xs mt-0.5">{t.body}</p>}
            </div>
            <button type="button" className="text-ink-faint hover:text-ink cursor-pointer" onClick={() => dismiss(t.id)} aria-label="Închide">
              <IconClose size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
