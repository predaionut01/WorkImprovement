import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  padded?: boolean;
  tone?: "default" | "orange" | "dark";
}

export function Card({ title, subtitle, action, padded = true, tone = "default", className = "", children, ...rest }: CardProps) {
  const toneCls =
    tone === "orange"
      ? "bg-ing-orange text-white"
      : tone === "dark"
        ? "bg-ink text-white"
        : "bg-white text-ink border border-line";
  return (
    <section className={`rounded-card shadow-card ${toneCls} ${className}`} {...rest}>
      {(title || action) && (
        <header className={`flex items-start justify-between gap-3 ${padded ? "px-5 pt-4" : "px-4 pt-3"}`}>
          <div>
            {title && <h2 className="text-base font-semibold leading-tight">{title}</h2>}
            {subtitle && <p className={`text-xs mt-0.5 ${tone === "default" ? "text-ink-muted" : "opacity-80"}`}>{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={padded ? "px-5 py-4" : ""}>{children}</div>
    </section>
  );
}
