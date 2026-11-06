import type { Card } from "@/lib/types";
import { CARD_TYPE } from "@/lib/ui/labels";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { fmtMoney } from "@/lib/ui/format";

export function cardStatusBadge(status: Card["status"]) {
  if (status === "active") return <Badge tone="success" dot>Activ</Badge>;
  if (status === "blocked") return <Badge tone="danger" dot>Blocat</Badge>;
  return <Badge tone="warning" dot>Înghețat</Badge>;
}

export function CardVisual({ card, compact }: { card: Card; compact?: boolean }) {
  const bg =
    card.type === "credit"
      ? "bg-gradient-to-br from-[#2b2b2b] to-[#4a4a4a] text-white"
      : card.type === "virtual"
        ? "bg-gradient-to-br from-[#ff8a3d] to-[#ff6200] text-white"
        : "bg-gradient-to-br from-[#ff6200] to-[#d94f00] text-white";
  const blocked = card.status !== "active";
  return (
    <div className={`relative flex ${compact ? "h-32" : "h-40"} w-full flex-col justify-between overflow-hidden rounded-xl p-4 shadow-card ${bg} ${blocked ? "opacity-80 grayscale-[35%]" : ""}`}>
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider opacity-90">{CARD_TYPE[card.type]}</span>
        <span className="text-xs font-bold">{card.brand}</span>
      </div>
      <div>
        <p className="font-mono text-lg tracking-[0.2em]">•••• •••• •••• {card.last4}</p>
        <div className="mt-1 flex items-center justify-between text-[11px] opacity-90">
          <span>{card.holder}</span>
          <span>exp. {card.expiry}</span>
        </div>
      </div>
      {blocked && (
        <span className="absolute right-3 top-8 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase text-danger">
          {card.status === "blocked" ? "Blocat" : "Înghețat"}
        </span>
      )}
    </div>
  );
}

export function CreditUsage({ card, className = "" }: { card: Card; className?: string }) {
  if (card.creditLimit === undefined) return null;
  const used = card.creditUsed ?? 0;
  return (
    <div className={className}>
      <div className="flex justify-between text-xs text-ink-muted">
        <span>Utilizat {fmtMoney(used, "RON")}</span>
        <span>Limită {fmtMoney(card.creditLimit, "RON", { decimals: 0 })}</span>
      </div>
      <ProgressBar value={used / card.creditLimit} tone={used / card.creditLimit > 0.8 ? "danger" : "orange"} className="mt-1" />
    </div>
  );
}
