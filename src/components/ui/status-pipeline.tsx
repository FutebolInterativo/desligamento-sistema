import { PIPELINE_ORDER, STATUS_SHORT, statusIndex, isCancelado } from "@/lib/status";
import type { StatusDesligamento } from "@/lib/types";
import { cn } from "@/lib/utils";

// Trilha horizontal do processo de desligamento. Cada desligamento é,
// literalmente, uma posição nessa sequência — por isso a trilha (e não um
// badge isolado) é o elemento central de toda tela de detalhe.
export function StatusPipeline({ status }: { status: StatusDesligamento }) {
  if (isCancelado(status)) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.04] px-4 py-3 text-sm text-red-300">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        Processo cancelado
      </div>
    );
  }

  const current = statusIndex(status);

  return (
    <div className="w-full overflow-x-auto">
      <ol className="flex min-w-max items-center">
        {PIPELINE_ORDER.map((step, i) => {
          const state = i < current ? "done" : i === current ? "current" : "pending";
          return (
            <li key={step} className="flex items-center">
              <div className="flex flex-col items-center gap-2 w-[92px]">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border font-mono-label text-[10px] transition-all",
                    state === "done" &&
                      "border-[var(--blue-600)]/60 bg-[var(--blue-600)]/20 text-[var(--blue-400)]",
                    state === "current" &&
                      "border-[var(--blue-400)] bg-[var(--blue-400)] text-[var(--midnight)] shadow-[0_0_0_4px_rgba(45,140,255,0.18),0_0_18px_rgba(45,140,255,0.65)]",
                    state === "pending" && "border-white/10 bg-white/[0.02] text-white/30"
                  )}
                >
                  {i + 1}
                </div>
                <span
                  className={cn(
                    "text-center text-[10.5px] font-mono-label leading-tight",
                    state === "current" ? "text-[var(--ink-000)]" : "text-white/35"
                  )}
                >
                  {STATUS_SHORT[step]}
                </span>
              </div>
              {i < PIPELINE_ORDER.length - 1 && (
                <div
                  className={cn(
                    "h-px w-6 -mt-5",
                    i < current ? "bg-[var(--blue-600)]/60" : "bg-white/10"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
