import { cn } from "@/lib/utils";
import type { StatusDesligamento } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/status";

const COLOR_BY_GROUP: Record<string, string> = {
  aberto: "bg-white/[0.06] text-white/70 border-white/10",
  emAndamento: "bg-[var(--blue-600)]/15 text-[var(--blue-400)] border-[var(--blue-600)]/40",
  concluido: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  cancelado: "bg-red-500/10 text-red-300 border-red-500/30",
};

function groupFor(status: StatusDesligamento): keyof typeof COLOR_BY_GROUP {
  if (status === "pago") return "concluido";
  if (status === "cancelado") return "cancelado";
  if (status === "conversa_registrada") return "aberto";
  return "emAndamento";
}

export function StatusBadge({ status }: { status: StatusDesligamento }) {
  const group = groupFor(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-mono-label",
        COLOR_BY_GROUP[group]
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          group === "emAndamento" && "bg-[var(--blue-400)] shadow-[0_0_6px_var(--blue-400)]",
          group === "concluido" && "bg-emerald-400",
          group === "cancelado" && "bg-red-400",
          group === "aberto" && "bg-white/50"
        )}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" | "warn" }) {
  const tones = {
    neutral: "bg-white/[0.05] text-white/70 border-white/10",
    accent: "bg-[var(--blue-600)]/15 text-[var(--blue-400)] border-[var(--blue-600)]/40",
    warn: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-mono-label", tones[tone])}>
      {children}
    </span>
  );
}
