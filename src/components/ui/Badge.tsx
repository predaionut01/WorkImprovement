import type { ReactNode } from "react";

export type Tone = "neutral" | "info" | "success" | "danger" | "warning" | "orange";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-muted",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  orange: "bg-ing-orange-soft text-ing-orange-dark",
};

export function Badge({ tone = "neutral", children, className = "", dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${tones[tone]} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
