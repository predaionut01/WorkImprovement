import type { Currency } from "@/lib/types";
import { fmtMoney } from "@/lib/ui/format";

interface MoneyProps {
  amount: number;
  currency: Currency | string;
  /** colour by sign */
  signed?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  decimals?: number;
}

const sizes = { sm: "text-sm", md: "text-base", lg: "text-xl", xl: "text-2xl" } as const;

export function Money({ amount, currency, signed, size = "md", className = "", decimals }: MoneyProps) {
  const color = signed ? (amount > 0 ? "text-success" : amount < 0 ? "text-ink" : "text-ink-muted") : "";
  const text = fmtMoney(amount, currency, { sign: signed, decimals });
  const [num, cur] = [text.slice(0, text.lastIndexOf(" ")), text.slice(text.lastIndexOf(" ") + 1)];
  return (
    <span className={`font-semibold tabular-nums ${sizes[size]} ${color} ${className}`}>
      {num} <span className="text-[0.72em] font-medium opacity-70">{cur}</span>
    </span>
  );
}
