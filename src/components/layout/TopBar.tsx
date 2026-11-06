"use client";

import Link from "next/link";
import { useBank } from "@/lib/ui/bank-store";
import { IconUser } from "@/components/ui/Icons";

export function TopBar() {
  const { data } = useBank();
  const name = data ? `${data.customer.firstName} ${data.customer.lastName}` : "Andrei Popescu";
  return (
    <header className="sticky top-0 z-40 bg-ing-orange text-white shadow-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight">Home&apos;Bank</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">PoC</span>
          </Link>
          <span className="hidden rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-medium sm:inline">PoC · date fictive</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/ops" className="hidden rounded-md px-2 py-1 text-xs font-semibold text-white/85 hover:bg-white/15 md:inline">
            Observabilitate
          </Link>
          <span className="flex items-center gap-2 font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
              <IconUser size={16} />
            </span>
            <span className="hidden sm:inline">{name}</span>
          </span>
          <button type="button" className="rounded-md border border-white/50 px-3 py-1 text-xs font-semibold hover:bg-white/15 cursor-pointer" onClick={() => undefined}>
            Ieșire
          </button>
        </div>
      </div>
    </header>
  );
}
