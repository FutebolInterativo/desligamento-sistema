import Link from "next/link";
import { ArrowLeft, FileText, AlertTriangle } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPipeline } from "@/components/ui/status-pipeline";
import { StatusBadge, Pill } from "@/components/ui/badge";
import { formatBRL, formatDate, formatDateTime } from "@/lib/utils";
import type {
  Desligamento,
  Colaborador,
  Acordo,
  ValoresFinanceiros,
  SolicitacaoAdvogado,
  DocumentoRow,
  Procedimentos,
  Pagamento,
  ParcelaPagamento,
} from "@/lib/types";
import { RegistrarPagamentoForm } from "./registrar-pagamento-form";

const TIPO_DOCUMENTO_LABEL: Record<string, string> = {
  contrato_atual: "Contrato atual",
  minuta_distrato: "Minuta do distrato",
  distrato_assinado: "Distrato assinado",
  nota_fiscal: "Nota fiscal",
};

export default async function FinanceiroDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["financeiro", "admin"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("desligamentos")
    .select(
      `*, colaborador:colaboradores(*), acordo:acordos(*), valores:valores_financeiros(*),
       solicitacoes_advogado(*), pagamento:pagamentos(*), documentos(*),
       procedimentos(*), parcelas_pagamento(*)`
    )
    .eq("id", id)
    .single();

  if (!data) return <p className="text-white/50">Desligamento não encontrado.</p>;

  const desligamento = data as Desligamento & {
    colaborador: Colaborador;
    acordo: Acordo[];
    valores: ValoresFinanceiros | null;
    solicitacoes_advogado: SolicitacaoAdvogado[];
    pagamento: Pagamento | null;
    documentos: DocumentoRow[];
    procedimentos: Procedimentos | null;
    parcelas_pagamento: ParcelaPagamento[];
  };

  const acordo = desligamento.acordo?.[0];
  const valores = desligamento.valores;
  const pagamento = desligamento.pagamento;
  const procedimentos = desligamento.procedimentos;
  const solicitacaoAdvogado = desligamento.solicitacoes_advogado?.sort((a, b) =>
    b.solicitado_em.localeCompare(a.solicitado_em)
  )?.[0];

  const distratoAprovado = desligamento.documentos?.some(
    (d) => d.tipo === "distrato_assinado" && d.status === "aprovado"
  );

  const documentosComLink = await Promise.all(
    (desligamento.documentos ?? []).map(async (doc) => ({
      ...doc,
      url: await getSignedUrl(doc.arquivo_path),
    }))
  );

  return (
    <div className="max-w-2xl">
      <Link href="/financeiro" className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70">
        <ArrowLeft size={14} />
        Voltar
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--ink-000)]">
            {desligamento.colaborador?.nome}
          </h1>
          <p className="mt-1 text-sm text-white/40">
            conversa em {formatDate(desligamento.data_conversa)}
          </p>
        </div>
        <StatusBadge status={desligamento.status} />
      </div>

      <Card className="mb-6">
        <CardBody className="py-6">
          <StatusPipeline status={desligamento.status} />
        </CardBody>
      </Card>

      {/* Leitura: conversa/acordo */}
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
          <div className="flex gap-2">
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

      {/* Leitura: valores (preenchidos pelo gestor, incluindo dias úteis/trabalhados) */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Valores do desligamento</CardTitle>
        </CardHeader>
        <CardBody className="text-sm">
          {valores ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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
                  <p className="text-white/40 text-xs">Valor de multa</p>
                  <p className="text-white/85">{formatBRL(valores.valor_multa)}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Valor de acordo</p>
                  <p className="text-white/85">{formatBRL(valores.valor_acordo)}</p>
                </div>
              </div>

              {valores.dias_trabalhados != null ? (
                <div className="space-y-1.5 rounded-lg border border-white/10 bg-[var(--midnight)]/40 p-3">
                  <p className="mb-1 text-xs font-mono-label text-white/40">Como o valor é calculado</p>
                  <div className="flex items-center justify-between text-white/60">
                    <span>
                      Proporcional (salário ÷ dias úteis × dias trabalhados) — {formatBRL(valores.salario_base)} ÷{" "}
                      {valores.dias_uteis_mes ?? 30} × {valores.dias_trabalhados}
                    </span>
                    <span className="text-white/85">
                      {formatBRL(
                        Math.round(
                          (valores.salario_base / (valores.dias_uteis_mes ?? 30)) * valores.dias_trabalhados * 100
                        ) / 100
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-white/60">
                    <span>
                      {valores.multa_responsavel === "colaborador" ? "− Multa" : "+ Multa"}
                      {acordo?.tem_multa && acordo.multa_responsavel && (
                        <span className="text-white/35">
                          {" "}
                          ({acordo.multa_responsavel === "empresa" ? "paga pela FI" : "descontada do colaborador"})
                        </span>
                      )}
                    </span>
                    <span className={valores.multa_responsavel === "colaborador" ? "text-red-300" : "text-white/85"}>
                      {formatBRL(valores.valor_multa)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-white/60">
                    <span>+ Acordo</span>
                    <span className="text-white/85">{formatBRL(valores.valor_acordo)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-1.5 text-white/40">
                    <span>= Valor total apurado</span>
                    <span className="font-display text-[var(--blue-400)]">{formatBRL(valores.valor_total)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-300">
                  Aguardando o gestor informar os dias trabalhados no mês para fechar o valor total.
                </p>
              )}
            </div>
          ) : (
            <p className="text-white/40">Nenhum valor informado pelo gestor ainda.</p>
          )}
        </CardBody>
      </Card>

      {/* Leitura: status da solicitação ao advogado */}
      {solicitacaoAdvogado && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Solicitação ao advogado</CardTitle>
          </CardHeader>
          <CardBody className="space-y-1.5 text-sm text-white/70">
            <p>
              <span className="text-white/40">Advogado: </span>
              {solicitacaoAdvogado.advogado_nome} · {solicitacaoAdvogado.advogado_email}
            </p>
            <p>
              <span className="text-white/40">Status: </span>
              {solicitacaoAdvogado.usado_em ? "Distrato recebido" : "Aguardando envio"}
            </p>
          </CardBody>
        </Card>
      )}

      {/* Leitura: documentos com link para visualizar */}
      {documentosComLink.length > 0 && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Documentos</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2.5">
            {documentosComLink.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between text-sm">
                <span className="text-white/70">
                  {TIPO_DOCUMENTO_LABEL[doc.tipo] ?? doc.tipo} · {formatDateTime(doc.uploaded_at)}
                </span>
                {doc.url ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[var(--blue-400)] hover:underline"
                  >
                    <FileText size={14} />
                    Ver arquivo
                  </a>
                ) : (
                  <span className="text-white/30 text-xs">Indisponível</span>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Leitura: procedimentos administrativos */}
      {procedimentos && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Procedimentos administrativos</CardTitle>
          </CardHeader>
          <CardBody className="space-y-1.5 text-sm text-white/70">
            <p>Notebook recolhido: {procedimentos.notebook_recolhido ? "Sim" : "Não"}</p>
            <p>Celular recolhido: {procedimentos.celular_recolhido ? "Sim" : "Não"}</p>
            <p>E-mail desativado: {procedimentos.email_desativado ? "Sim" : "Não"}</p>
            <p>Removido do Slack: {procedimentos.slack_removido ? "Sim" : "Não"}</p>
            <p>Documentos do contrato arquivados: {procedimentos.documentos_contrato_arquivados ? "Sim" : "Não"}</p>
            <p>Wellhub cancelado: {procedimentos.wellhub_cancelado ? "Sim" : "Não"}</p>
            <p>Removido do grupo de avisos: {procedimentos.grupo_avisos_removido ? "Sim" : "Não"}</p>
            <p>Alice cancelado: {procedimentos.alice_cancelado ? "Sim" : "Não"}</p>
          </CardBody>
        </Card>
      )}

      {/* Leitura: NF (anexada pelo RH, recebida do colaborador fora do sistema) e pagamento */}
      {pagamento && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Nota fiscal e pagamento</CardTitle>
          </CardHeader>
          <CardBody className="space-y-5">
            <p className="text-sm text-white/60">
              Previsto para {formatDate(pagamento.data_prevista)} (5º dia útil, junto com a folha).
            </p>

            {pagamento.nf_necessaria && !pagamento.nf_emitida && (
              <p className="text-sm text-white/60 border-t border-white/[0.06] pt-4">
                Este caso exige NF. O colaborador envia o arquivo diretamente ao RH, que anexa no
                sistema — aguardando.
              </p>
            )}

            {pagamento.nf_necessaria && pagamento.nf_emitida && (
              <p className="text-sm text-emerald-300">NF {pagamento.nf_numero} recebida do colaborador.</p>
            )}

            {pagamento.status !== "pago" ? (
              <RegistrarPagamentoForm
                desligamentoId={desligamento.id}
                distratoAprovado={Boolean(distratoAprovado)}
                nfPendente={pagamento.nf_necessaria && !pagamento.nf_emitida}
                parcelas={(desligamento.parcelas_pagamento ?? []).sort(
                  (a, b) => a.numero_parcela - b.numero_parcela
                )}
                valorTotal={valores?.valor_total ?? null}
              />
            ) : (
              <p className="text-sm text-emerald-300">
                Pagamento de {formatBRL(pagamento.valor_pago)} registrado em{" "}
                {formatDate(pagamento.data_realizado)}.
              </p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}