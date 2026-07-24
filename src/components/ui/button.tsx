import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--blue-600)] text-white shadow-[0_0_0_1px_rgba(0,117,237,0.4),0_8px_24px_-8px_rgba(0,117,237,0.55)] hover:bg-[var(--blue-400)] hover:shadow-[0_0_0_1px_rgba(45,140,255,0.6),0_10px_28px_-6px_rgba(45,140,255,0.65)] active:translate-y-px",
  secondary:
    "bg-white/[0.04] text-[var(--ink-000)] border border-white/10 hover:border-[var(--blue-400)]/60 hover:bg-white/[0.07]",
  ghost: "text-[var(--ink-000)]/70 hover:text-[var(--ink-000)] hover:bg-white/[0.05]",
  danger:
    "bg-transparent border border-red-500/30 text-red-300 hover:bg-red-500/10 hover:border-red-500/50",
};

const sizes: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5",
  md: "text-sm px-4 py-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
