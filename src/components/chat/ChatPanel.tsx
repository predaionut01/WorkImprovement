"use client";

import { useState, type KeyboardEvent } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { IconClose, IconRefresh, IconSend } from "@/components/ui/Icons";
import { MessageList } from "./MessageList";
import { TracePanel } from "./TracePanel";
import { DEMO_CHIPS } from "./types";
import type { ChatController } from "./useChat";

export function ChatPanel({ chat, onClose }: { chat: ChatController; onClose: () => void }) {
  const [text, setText] = useState("");
  const [showTrace, setShowTrace] = useState(true);
  const [mobileTab, setMobileTab] = useState<"chat" | "trace">("chat");

  const submit = () => {
    if (!text.trim() || chat.busy) return;
    chat.send(text);
    setText("");
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };
  const lastDone = [...chat.items].reverse().find((x) => x.kind === "assistant" && x.meta);
  const totalMs = lastDone?.kind === "assistant" ? lastDone.meta?.totalMs : undefined;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-none bg-white shadow-2xl md:rounded-2xl md:border md:border-line">
      {/* header */}
      <header className="flex items-center justify-between gap-3 bg-ing-orange px-4 py-2.5 text-white">
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight">Asistentul Home&apos;Bank</p>
          <p className="truncate text-[10px] text-white/85">Conversație asistată de AI, poate fi evaluată pentru calitate.</p>
        </div>
        <div className="flex items-center gap-1">
          <div className="mr-1 flex rounded-md bg-white/15 p-0.5 text-[11px] font-semibold md:hidden">
            <button type="button" className={`rounded px-2 py-0.5 cursor-pointer ${mobileTab === "chat" ? "bg-white text-ing-orange-dark" : ""}`} onClick={() => setMobileTab("chat")}>
              Chat
            </button>
            <button type="button" className={`rounded px-2 py-0.5 cursor-pointer ${mobileTab === "trace" ? "bg-white text-ing-orange-dark" : ""}`} onClick={() => setMobileTab("trace")}>
              Trace
            </button>
          </div>
          <button type="button" onClick={chat.reset} title="Conversație nouă" className="rounded-md p-1.5 hover:bg-white/20 cursor-pointer" aria-label="Conversație nouă">
            <IconRefresh size={16} />
          </button>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 hover:bg-white/20 cursor-pointer" aria-label="Închide">
            <IconClose size={18} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* left: chat */}
        <div className={`flex min-w-0 flex-1 flex-col ${mobileTab === "trace" ? "hidden md:flex" : "flex"}`}>
          <MessageList chat={chat} />

          {/* chips */}
          <div className="flex gap-1.5 overflow-x-auto hb-scroll border-t border-line px-3 py-2">
            {DEMO_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={chat.busy}
                onClick={() => chat.send(c)}
                className="shrink-0 rounded-full border border-line bg-white px-3 py-1 text-[11px] font-medium text-ink hover:border-ing-orange hover:text-ing-orange-dark disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {c}
              </button>
            ))}
          </div>

          {/* input */}
          <div className="border-t border-line px-3 py-2">
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKey}
                rows={1}
                placeholder="Scrie un mesaj… (Enter trimite, Shift+Enter rând nou)"
                className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-line px-3 py-2 text-sm focus:border-ing-orange focus:outline-none focus:ring-2 focus:ring-ing-orange/30"
              />
              {chat.busy ? (
                <button type="button" onClick={chat.cancel} className="h-10 rounded-xl border border-line px-3 text-xs font-semibold text-ink-muted hover:bg-surface cursor-pointer">
                  Oprește
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!text.trim()}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-ing-orange text-white hover:bg-ing-orange-dark disabled:bg-ing-orange/40 cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Trimite"
                >
                  <IconSend size={18} />
                </button>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-ink-muted">
              <button type="button" onClick={() => chat.send("Vreau să vorbesc cu un agent.")} disabled={chat.busy} className="font-semibold text-ing-orange-dark hover:underline cursor-pointer disabled:opacity-50">
                Vreau un agent
              </button>
              <div className="flex items-center gap-3">
                <Toggle size="sm" checked={chat.providerDown} onChange={chat.setProviderDown} label="Simulează provider principal căzut" />
                <span className="hidden md:inline-flex">
                  <Toggle size="sm" checked={showTrace} onChange={setShowTrace} label="Trace" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* right: trace */}
        <aside className={`w-full border-l border-line bg-white md:w-[400px] md:shrink-0 ${mobileTab === "trace" ? "flex" : "hidden"} ${showTrace ? "md:flex" : "md:hidden"} flex-col`}>
          <TracePanel trace={chat.trace} busy={chat.busy} turnId={chat.lastTurnId} totalMs={chat.busy ? undefined : totalMs} />
        </aside>
      </div>
    </div>
  );
}
