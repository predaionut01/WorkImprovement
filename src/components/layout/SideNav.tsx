"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav";

export function SideNav() {
  const path = usePathname();
  return (
    <nav aria-label="Secțiuni" className="w-full lg:w-56 lg:shrink-0">
      <ul className="flex gap-1 overflow-x-auto hb-scroll pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {NAV.map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-white text-ing-orange-dark shadow-card border border-line" : "text-ink-muted hover:bg-white/70 hover:text-ink"
                }`}
              >
                <Icon size={18} />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 hidden px-3 text-[11px] leading-snug text-ink-faint lg:block">
        Mediu demonstrativ. Toate datele sunt fictive; nu există autentificare.
      </p>
    </nav>
  );
}
