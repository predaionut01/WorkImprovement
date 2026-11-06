"use client";

import { useState } from "react";
import { IconChat, IconClose } from "@/components/ui/Icons";
import { ChatPanel } from "./ChatPanel";
import { useChat } from "./useChat";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const chat = useChat();
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[60] md:inset-auto md:bottom-24 md:right-6 md:h-[640px] md:max-h-[calc(100vh-7rem)] md:w-[1000px] md:max-w-[calc(100vw-3rem)] hb-pop">
          <ChatPanel chat={chat} onClose={() => setOpen(false)} />
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          // a fresh session id per panel open, unless a conversation is already in progress
          if (!open && chat.items.length === 0) chat.reset();
          setOpen((o) => !o);
        }}
        className="fixed bottom-6 right-6 z-[61] flex h-14 items-center gap-2 rounded-full bg-ing-orange px-5 text-sm font-bold text-white shadow-xl hover:bg-ing-orange-dark cursor-pointer"
        aria-expanded={open}
        aria-label={open ? "Închide asistentul" : "Deschide asistentul"}
      >
        {open ? <IconClose size={20} /> : <IconChat size={20} />}
        <span className="hidden sm:inline">Asistent</span>
        {chat.busy && <span className="h-2 w-2 animate-pulse rounded-full bg-white" />}
      </button>
    </>
  );
}
