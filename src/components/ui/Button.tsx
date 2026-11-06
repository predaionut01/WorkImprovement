import type { ButtonHTMLAttributes, ReactNode } from "react";
import { IconSpinner } from "./Icons";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: "bg-ing-orange text-white hover:bg-ing-orange-dark shadow-sm disabled:bg-ing-orange/50",
  secondary: "bg-white text-ink border border-line hover:border-ink-faint hover:bg-surface disabled:opacity-50",
  ghost: "bg-transparent text-ink hover:bg-surface-2 disabled:opacity-50",
  danger: "bg-danger text-white hover:bg-red-700 disabled:opacity-50",
  link: "bg-transparent text-ing-orange-dark underline-offset-2 hover:underline px-0 disabled:opacity-50",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-lg gap-2",
  lg: "h-12 px-5 text-base rounded-xl gap-2",
};

export function Button({ variant = "primary", size = "md", loading, icon, className = "", children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ing-orange/50 cursor-pointer disabled:cursor-not-allowed ${variants[variant]} ${variant === "link" ? "" : sizes[size]} ${className}`}
      {...rest}
    >
      {loading ? <IconSpinner size={16} /> : icon}
      {children}
    </button>
  );
}
