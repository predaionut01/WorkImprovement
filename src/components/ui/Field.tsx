import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

const inputCls =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-ink-faint focus:border-ing-orange focus:outline-none focus:ring-2 focus:ring-ing-orange/30 disabled:bg-surface";

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="mb-1 flex items-baseline justify-between text-xs font-semibold text-ink-muted">
      {children}
      {hint && <span className="font-normal">{hint}</span>}
    </span>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputCls} ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputCls} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children, className = "" }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <Label hint={hint}>{label}</Label>
      {children}
    </label>
  );
}
