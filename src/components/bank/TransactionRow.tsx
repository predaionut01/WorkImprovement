import type { Transaction } from "@/lib/types";
import { fmtDateTime } from "@/lib/ui/format";
import { CATEGORY_COLORS } from "@/lib/ui/labels";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";

export function CategoryDot({ category }: { category: Transaction["category"] }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[category] }} aria-hidden />;
}

export function TransactionRow({ tx, onClick }: { tx: Transaction; onClick?: () => void }) {
  const pending = tx.status === "pending";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-2 py-2.5 text-left transition-colors hover:bg-surface rounded-lg ${onClick ? "cursor-pointer" : "cursor-default"} ${pending ? "opacity-75" : ""}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-bold" style={{ color: CATEGORY_COLORS[tx.category] }}>
        {tx.merchant.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{tx.merchant}</span>
          {pending && (
            <Badge tone="warning" className="shrink-0">
              În procesare
            </Badge>
          )}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <CategoryDot category={tx.category} />
          {tx.category} · {fmtDateTime(tx.date)}
        </span>
      </span>
      <Money amount={tx.amount} currency={tx.currency} signed size="sm" className={pending ? "italic" : ""} />
    </button>
  );
}
