import Link from "next/link";
import { ArrowLeft, FileText, AlertTriangle } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPipeline } from "@/components/ui/status-pipeline";
import { StatusBadge, Pill } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { formatBRL, formatDate, formatDateTime } from "@/lib/utils";
import { atualizarDiasAction } from "../actions";
import type {
  Desligamento,
  Colaborador,
  Acordo,
  ValoresFinanceiros,
  SolicitacaoAdvogado,
  DocumentoRow,
  Pagamento,
} from "@/lib/types";

const TIPO_VINCULO_LABEL: Record<string, string> = {
  clt: "CLT",
  pj: "PJ",
  estagio: "Estágio",
};

export default async function GestorDesligamentoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireRole(["gestor", "admin"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("desligamentos")
    .select(
      `*, colaborador:colaboradores(*), acordo:acordos(*), valores:valores_financeiros(*),
       solicitacoes:solicitacoes_advogado(*), documentos(*), pagamento:pagamentos(*)`
    )
    .eq("id", id)
    .eq("gestor_id", profile.id)
    .single();

  if (!data) {
    return <p className="text-white/50">Desligamento não encontrado.</p>;
  }

  const desligamento = data as Desligamento & {
    colaborador: Colaborador;
    acordo: Acordo[];
    valores: ValoresFinanceiros | null;
    solicitacoes: SolicitacaoAdvogado[];
    documentos: DocumentoRow[];
    pagamento: Pagamento | null;
  };

  const acordo = desligamento.acordo?.[0];
  const valores = desligamento.valores;
  const solicitacao = desligamento.solicitacoes?.sort((a, b) =>
    b.solicitado_em.localeCompare(a.solicitado_em)
  )?.[0];
  const distratoAssinado = desligamento.documentos?.find((d) => d.tipo === "distrato_assinado");
  const pagamento = desligamento.pagamento;
  const status = desligamento.status;

  return (
    <div className="max-w-3xl">
      <Link href="/gestor" className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70">
        <ArrowLeft size={14} />
        Voltar para meus desligamentos
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--ink-000)]">
            {desligamento.colaborador?.nome}
          </h1>
          <p className="mt-1 text-sm text-white/40">
            {desligamento.colaborador?.cargo ?? "Sem cargo informado"} ·{" "}
            {TIPO_VINCULO_LABEL[desligamento.colaborador?.tipo_vinculo] ?? "CLT"} · conversa em{" "}
            {formatDate(desligamento.data_conversa)}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <Card className="mb-6">
        <CardBody className="py-6">
          <StatusPipeline status={status} />
        </CardBody>
      </Card>

      {/* Acordo */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Conversa e condições acordadas</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm">
          {desligamento.motivo && (
            <p className="text-white/70">
              <span className="text-white/40">Motivo: </span>
              {desligamento.motivo}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Pill tone={acordo?.tem_multa ? "warn" : "neutral"}>
              {acordo?.tem_multa ? "Com multa" : "Sem multa"}
            </Pill>
            <Pill tone={acordo?.tem_acordo ? "accent" : "neutral"}>
              {acordo?.tem_acordo ? "Com acordo específico" : "Sem acordo específico"}
            </Pill>
          </div>
          {acordo?.tem_multa && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <AlertTriangle size={16} className="flex-none text-amber-400" />
              <span className="text-sm font-medium text-amber-200">
                {acordo.multa_responsavel === "empresa"
                  ? "A multa é paga pela FI"
                  : acordo.multa_responsavel === "colaborador"
                  ? "A multa é paga pelo colaborador"
                  : "Responsável pela multa ainda não informado"}
              </span>
            </div>
          )}
          {acordo?.condicoes && <p className="text-white/70">{acordo.condicoes}</p>}
        </CardBody>
      </Card>

      {/* Valores negociados */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Valores</CardTitle>
        </CardHeader>
        <CardBody className="text-sm">
          {valores ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div>
                  <p className="text-white/40 text-xs">Salário base</p>
                  <p className="text-white/85">{formatBRL(valores.salario_base)}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Dias úteis no mês</p>
                  <p className="text-white/85">{valores.dias_uteis_mes ?? "—"}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Dias trabalhados</p>
                  <p className="text-white/85">{valores.dias_trabalhados ?? "—"}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">
                    Multa {valores.multa_responsavel === "colaborador" ? "(desconto)" : ""}
                  </p>
                  <p className={valores.multa_responsavel === "colaborador" ? "text-red-300" : "text-white/85"}>
                    {valores.multa_responsavel === "colaborador" ? "− " : ""}
                    {formatBRL(valores.valor_multa)}
                  </p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Acordo</p>
                  <p className="text-white/85">{formatBRL(valores.valor_acordo)}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Valor total</p>
                  <p className="font-display text-[var(--blue-400)]">
                    {valores.valor_total != null ? formatBRL(valores.valor_total) : "a calcular"}
                  </p>
                </div>
              </div>

              <form
                action={atualizarDiasAction}
                className="flex flex-wrap items-end gap-3 border-t border-white/[0.06] pt-4"
              >
                <input type="hidden" name="desligamento_id" value={desligamento.id} />
                <div className="w-40">
                  <Field label="Dias úteis no mês" hint="Total de dias úteis no mês do desligamento">
                    <Input
                      type="number"
                      name="dias_uteis_mes"
                      min="1"
                      max="31"
                      defaultValue={valores.dias_uteis_mes ?? undefined}
                      required
                    />
                  </Field>
                </div>
                <div className="w-40">
                  <Field label="Dias trabalhados no mês" hint="Necessário pra fechar o valor total">
                    <Input
                      type="number"
                      name="dias_trabalhados"
                      min="1"
                      max="31"
                      defaultValue={valores.dias_trabalhados ?? undefined}
                      required
                    />
                  </Field>
                </div>
                <Button type="submit" size="sm" variant="secondary">
                  {valores.dias_uteis_mes != null && valores.dias_trabalhados != null ? "Corrigir" : "Salvar"}
                </Button>
              </form>
            </div>
          ) : (
            <p className="text-white/40">Nenhum valor registrado ainda.</p>
          )}
        </CardBody>
      </Card>

      {/* Solicitação ao advogado */}
      {solicitacao && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Solicitação ao advogado</CardTitle>
          </CardHeader>
          <CardBody className="space-y-1.5 text-sm text-white/70">
            <p>
              <span className="text-white/40">Advogado: </span>
              {solicitacao.advogado_nome} · {solicitacao.advogado_email}
            </p>
            <p>
              <span className="text-white/40">Enviada em: </span>
              {formatDateTime(solicitacao.solicitado_em)}
            </p>
            <p>
              <span className="text-white/40">Prazo estimado: </span>
              {formatDate(solicitacao.prazo_limite)}
            </p>
          </CardBody>
        </Card>
      )}

      {/* Distrato assinado */}
      {distratoAssinado && (
        <Card className="mb-5">
          <CardBody className="flex items-center justify-between text-sm text-white/60">
            <span>Distrato assinado anexado em {formatDateTime(distratoAssinado.uploaded_at)}.</span>
            <FileText size={14} className="text-white/30" />
          </CardBody>
        </Card>
      )}

      {/* Pagamento */}
      {pagamento && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Pagamento</CardTitle>
          </CardHeader>
          <CardBody className="space-y-1.5 text-sm text-white/70">
            <p>
              <span className="text-white/40">Previsto para: </span>
              {formatDate(pagamento.data_prevista)}
            </p>
            <p>
              <span className="text-white/40">Status: </span>
              {pagamento.status === "pago" ? "Pago" : "Aguardando financeiro"}
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}