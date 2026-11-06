"use client";

import { useEffect, type ReactNode } from "react";
import { IconClose } from "./Icons";

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl hb-pop">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-muted hover:bg-surface cursor-pointer" aria-label="Închide">
            <IconClose size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto hb-scroll px-5 py-4 text-sm">{children}</div>
      </aside>
    </div>
  );
}
