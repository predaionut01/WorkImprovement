interface ProgressBarProps {
  value: number; // 0..1
  tone?: "orange" | "success" | "danger" | "info" | "neutral";
  height?: number;
  className?: string;
}
const tones = {
  orange: "bg-ing-orange",
  success: "bg-success",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-ink-faint",
} as const;

export function ProgressBar({ value, tone = "orange", height = 8, className = "" }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={`w-full overflow-hidden rounded-full bg-surface-2 ${className}`} style={{ height }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all ${tones[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
