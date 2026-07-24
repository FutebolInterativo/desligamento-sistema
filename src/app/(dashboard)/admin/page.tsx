import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { PIPELINE_ORDER, STATUS_LABEL } from "@/lib/status";
import type { Desligamento, Colaborador, SolicitacaoAdvogado } from "@/lib/types";

export default async function AdminPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("desligamentos")
    .select("*, colaborador:colaboradores(*)")
    .order("created_at", { ascending: false });

  const desligamentos = (data ?? []) as (Desligamento & { colaborador: Colaborador })[];

  const { data: solicitacoesData } = await supabase
    .from("solicitacoes_advogado")
    .select("*")
    .is("usado_em", null);
  const solicitacoesAbertas = (solicitacoesData ?? []) as SolicitacaoAdvogado[];
  const hoje = new Date().toISOString().slice(0, 10);
  const prazosVencidos = solicitacoesAbertas.filter(
    (s) => s.prazo_limite && s.prazo_limite < hoje
  );

  const counts = PIPELINE_ORDER.reduce<Record<string, number>>((acc, status) => {
    acc[status] = desligamentos.filter((d) => d.status === status).length;
    return acc;
  }, {});
  const total = desligamentos.length;
  const concluidos = counts["pago"] ?? 0;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-[var(--ink-000)]">Painel geral</h1>
      <p className="mt-1 mb-8 text-sm text-white/40">
        Visão consolidada, somente leitura, de todos os desligamentos do sistema.
      </p>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardBody className="py-4">
            <p className="font-display text-2xl font-semibold text-[var(--ink-000)]">{total}</p>
            <p className="mt-0.5 text-xs text-white/40">Total de desligamentos</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <p className="font-display text-2xl font-semibold text-emerald-300">{concluidos}</p>
            <p className="mt-0.5 text-xs text-white/40">Concluídos (pagos)</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <p className="font-display text-2xl font-semibold text-[var(--blue-400)]">
              {total - concluidos}
            </p>
            <p className="mt-0.5 text-xs text-white/40">Em andamento</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <p className="font-display text-2xl font-semibold text-amber-300">
              {prazosVencidos.length}
            </p>
            <p className="mt-0.5 text-xs text-white/40">Prazos de advogado vencidos</p>
          </CardBody>
        </Card>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {PIPELINE_ORDER.map((status) => (
          <Card key={status}>
            <CardBody className="py-3.5">
              <p className="font-display text-lg font-semibold text-[var(--blue-400)]">
                {counts[status] ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] leading-tight text-white/40">
                {STATUS_LABEL[status as keyof typeof STATUS_LABEL]}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <h2 className="font-display text-sm font-semibold text-white/70 mb-3">Todos os casos</h2>
      <div className="space-y-2.5">
        {desligamentos.map((d) => (
          <Card key={d.id}>
            <CardBody className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-[var(--ink-000)]">{d.colaborador?.nome}</p>
                <p className="mt-0.5 text-xs text-white/40">
                  conversa em {formatDate(d.data_conversa)}
                </p>
              </div>
              <StatusBadge status={d.status} />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
