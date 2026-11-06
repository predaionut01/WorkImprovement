"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BankProvider } from "@/lib/ui/bank-store";
import { ToastProvider } from "@/components/ui/Toast";
import { TopBar } from "./TopBar";
import { SideNav } from "./SideNav";
import { ChatWidget } from "@/components/chat/ChatWidget";

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const isOps = path.startsWith("/ops");
  return (
    <BankProvider>
      <ToastProvider>
        <div className="flex min-h-screen flex-col">
          <TopBar />
          <div className={`mx-auto flex w-full flex-1 flex-col gap-4 px-4 py-5 lg:flex-row lg:gap-6 ${isOps ? "max-w-[1600px]" : "max-w-[1400px]"}`}>
            {!isOps && <SideNav />}
            <main className="min-w-0 flex-1">{children}</main>
          </div>
          <footer className="border-t border-line bg-white/60 py-3 text-center text-[11px] text-ink-faint">
            Home&apos;Bank PoC · date fictive · demo intern pentru inginerii ING · fără logo-uri sau date reale
          </footer>
        </div>
        <ChatWidget />
      </ToastProvider>
    </BankProvider>
  );
}
