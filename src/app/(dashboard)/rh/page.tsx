import Link from "next/link";
import { Inbox } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { PIPELINE_ORDER, STATUS_LABEL } from "@/lib/status";
import type { Desligamento, Colaborador } from "@/lib/types";

export default async function RhPage() {
  await requireRole(["rh", "admin"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("desligamentos")
    .select("*, colaborador:colaboradores(*)")
    .order("created_at", { ascending: false });

  const desligamentos = (data ?? []) as (Desligamento & { colaborador: Colaborador })[];

  const counts = PIPELINE_ORDER.reduce<Record<string, number>>((acc, status) => {
    acc[status] = desligamentos.filter((d) => d.status === status).length;
    return acc;
  }, {});

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-[var(--ink-000)]">Visão geral</h1>
      <p className="mt-1 mb-8 text-sm text-white/40">
        Todos os desligamentos em andamento, do envio pelo gestor até o pagamento.
      </p>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {PIPELINE_ORDER.filter((s) => counts[s] > 0 || s === "aguardando_distrato" || s === "aguardando_pagamento").map((status) => (
          <Card key={status}>
            <CardBody className="py-3.5">
              <p className="font-display text-xl font-semibold text-[var(--blue-400)]">
                {counts[status] ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] leading-tight text-white/40">
                {STATUS_LABEL[status as keyof typeof STATUS_LABEL]}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      {desligamentos.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nenhum desligamento em andamento"
          description="Quando um gestor registrar uma conversa de desligamento, ela aparece aqui."
        />
      ) : (
        <div className="space-y-2.5">
          {desligamentos.map((d) => (
            <Link key={d.id} href={`/rh/${d.id}`}>
              <Card className="transition-colors hover:border-[var(--blue-600)]/40">
                <CardBody className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-sm font-medium text-[var(--ink-000)]">
                      {d.colaborador?.nome}
                    </p>
                    <p className="mt-0.5 text-xs text-white/40">
                      conversa em {formatDate(d.data_conversa)}
                    </p>
                  </div>
                  <StatusBadge status={d.status} />
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
