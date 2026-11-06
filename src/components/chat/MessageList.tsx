"use client";

import { useEffect, useRef } from "react";
import { BRANCH, INTENT } from "@/lib/ui/labels";
import { fmtMs } from "@/lib/ui/format";
import { ActionCard } from "./ActionCard";
import type { ChatController } from "./useChat";
import type { ChatItem } from "./types";

function Assistant({ m }: { m: Extract<ChatItem, { kind: "assistant" }> }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-surface px-4 py-2.5 text-sm leading-relaxed text-ink">
        {m.content || (m.streaming ? "" : "…")}
        {m.streaming && <span className="hb-caret" />}
      </div>
      {m.meta && (
        <p className="pl-1 text-[10px] text-ink-faint">
          <span className="font-semibold">{BRANCH[m.meta.branch]?.label ?? m.meta.branch}</span>
          {" · "}
          {INTENT[m.meta.intent] ?? m.meta.intent}
          {m.meta.model ? ` · ${m.meta.model}` : ""}
          {" · "}
          {fmtMs(m.meta.totalMs)}
        </p>
      )}
    </div>
  );
}

const systemTone = {
  info: "bg-surface-2 text-ink-muted",
  error: "bg-danger-soft text-danger",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
} as const;

export function MessageList({ chat }: { chat: ChatController }) {
  const ref = useRef<HTMLDivElement>(null);
  const len = chat.items.length;
  const lastContent = chat.items[len - 1]?.kind === "assistant" ? (chat.items[len - 1] as Extract<ChatItem, { kind: "assistant" }>).content.length : 0;
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [len, lastContent]);

  return (
    <div ref={ref} className="flex-1 space-y-3 overflow-y-auto hb-scroll px-4 py-4">
      {chat.items.length === 0 && (
        <div className="rounded-2xl rounded-tl-sm bg-surface px-4 py-3 text-sm text-ink">
          <p className="font-semibold">Bună, Andrei! Sunt asistentul Home&apos;Bank.</p>
          <p className="mt-1 text-ink-muted">
            Te pot ajuta cu întrebări despre conturile tale, transferuri, carduri, depozite sau produse ING. Pentru acțiuni (ex. blocarea unui card) îți cer mereu confirmarea.
          </p>
        </div>
      )}
      {chat.items.map((m) => {
        switch (m.kind) {
          case "user":
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-ing-orange px-4 py-2.5 text-sm leading-relaxed text-white">{m.content}</div>
              </div>
            );
          case "assistant":
            return <Assistant key={m.id} m={m} />;
          case "system":
            return (
              <div key={m.id} className="flex justify-center">
                <p className={`max-w-[90%] rounded-lg px-3 py-1.5 text-center text-xs ${systemTone[m.tone]}`}>{m.content}</p>
              </div>
            );
          case "action":
            return (
              <div key={m.id} className="flex justify-start pl-1">
                <ActionCard item={m} onState={(s) => chat.setActionState(m.id, s)} onSystem={chat.pushSystem} />
              </div>
            );
        }
      })}
    </div>
  );
}
