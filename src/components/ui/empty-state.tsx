import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.04] text-white/40">
        <Icon size={20} />
      </div>
      <p className="font-display text-sm font-medium text-white/80">{title}</p>
      <p className="max-w-sm text-sm text-white/40">{description}</p>
    </div>
  );
}
