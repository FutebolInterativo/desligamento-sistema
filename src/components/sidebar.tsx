"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Users,
  Scale,
  Wallet,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import type { Profile, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/(dashboard)/actions";

const NAV: Record<UserRole, { href: string; label: string; icon: typeof LayoutGrid }[]> = {
  gestor: [{ href: "/gestor", label: "Meus desligamentos", icon: Users }],
  rh: [{ href: "/rh", label: "Visão geral", icon: LayoutGrid }],
  financeiro: [{ href: "/financeiro", label: "Valores e pagamentos", icon: Wallet }],
  admin: [
    { href: "/admin", label: "Painel geral", icon: LayoutGrid },
    { href: "/admin/usuarios", label: "Usuários", icon: ShieldCheck },
  ],
};

const ROLE_LABEL: Record<UserRole, string> = {
  gestor: "Gestor",
  rh: "RH",
  financeiro: "Financeiro",
  admin: "Administrador",
};

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const items = NAV[profile.role];

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-none flex-col self-start border-r border-white/[0.06] bg-[var(--navy-900)]/70">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--blue-600)] shadow-[0_0_20px_rgba(0,117,237,0.5)]">
          <Scale size={16} className="text-white" />
        </div>
        <div>
          <p className="font-display text-sm font-semibold leading-none text-[var(--ink-000)]">Distrato</p>
          <p className="text-[11px] leading-none text-white/40 mt-0.5">fluxo de desligamento</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-[var(--blue-600)]/15 text-[var(--blue-400)] border border-[var(--blue-600)]/30"
                  : "text-white/55 hover:bg-white/[0.04] hover:text-white/85 border border-transparent"
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] px-4 py-4">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] font-mono-label text-[11px] text-white/70">
            {profile.nome.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-white/85">{profile.nome}</p>
            <p className="text-[11px] text-white/40">{ROLE_LABEL[profile.role]}</p>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/50 hover:bg-white/[0.04] hover:text-white/80"
          >
            <LogOut size={15} />
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
