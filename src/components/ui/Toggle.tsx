"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function Toggle({ checked, onChange, label, disabled, size = "md" }: ToggleProps) {
  const w = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const k = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const tx = size === "sm" ? (checked ? "translate-x-4" : "translate-x-0.5") : checked ? "translate-x-5.5" : "translate-x-0.5";
  return (
    <label className={`inline-flex items-center gap-2 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex ${w} shrink-0 items-center rounded-full transition-colors ${checked ? "bg-ing-orange" : "bg-surface-2 border border-line"} ${disabled ? "" : "cursor-pointer"}`}
      >
        <span className={`inline-block ${k} transform rounded-full bg-white shadow transition-transform ${tx}`} />
      </button>
      {label && <span className="text-sm select-none">{label}</span>}
    </label>
  );
}
