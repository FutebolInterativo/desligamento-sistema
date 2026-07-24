import Link from "next/link";
import { ArrowLeft, Send, FileCheck2, Upload, ClipboardCheck, Ban, FileText, IdCard, Mail } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPipeline } from "@/components/ui/status-pipeline";
import { StatusBadge, Pill } from "@/components/ui/badge";
import { Field, Input, Textarea, Checkbox } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { formatBRL, formatDate, formatDateTime } from "@/lib/utils";
import type {
  Desligamento,
  Colaborador,
  Acordo,
  ValoresFinanceiros,
  SolicitacaoAdvogado,
  SolicitacaoNf,
  DocumentoRow,
  Procedimentos,
  Pagamento,
} from "@/lib/types";
import {
  encaminharFinanceiroAction,
  solicitarAdvogadoAction,
  conferirDistratoAction,
  uploadDistratoAssinadoAction,
  atualizarProcedimentosAction,
  gerarLinkNfAction,
  cancelarDesligamentoAction,
  atualizarCpfAction,
  enviarDistratoAdvogadoAction,
} from "../actions";

export default async function DesligamentoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["rh", "admin"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("desligamentos")
    .select(
      `*, colaborador:colaboradores(*), acordo:acordos(*), valores:valores_financeiros(*),
       solicitacoes:solicitacoes_advogado(*), solicitacoes_nf(*), documentos(*), procedimentos(*), pagamento:pagamentos(*)`
    )
    .eq("id", id)
    .single();

  if (!data) {
    return <p className="text-white/50">Desligamento não encontrado.</p>;
  }

  const desligamento = data as Desligamento & {
    colaborador: Colaborador;
    acordo: Acordo[];
    valores: ValoresFinanceiros | null;
    solicitacoes: SolicitacaoAdvogado[];
    solicitacoes_nf: SolicitacaoNf[];
    documentos: DocumentoRow[];
    procedimentos: Procedimentos | null;
    pagamento: Pagamento | null;
  };

  const acordo = desligamento.acordo?.[0];
  const valores = desligamento.valores;
  const solicitacao = desligamento.solicitacoes?.sort((a, b) =>
    b.solicitado_em.localeCompare(a.solicitado_em)
  )?.[0];
  const solicitacaoNf = desligamento.solicitacoes_nf?.sort((a, b) =>
    b.solicitado_em.localeCompare(a.solicitado_em)
  )?.[0];
  const minuta = desligamento.documentos?.find((d) => d.tipo === "minuta_distrato");
  const distratoAssinado = desligamento.documentos?.find((d) => d.tipo === "distrato_assinado");
  const procedimentos = desligamento.procedimentos;
  const pagamento = desligamento.pagamento;

  const status = desligamento.status;

  const minutaUrl = minuta ? await getSignedUrl(minuta.arquivo_path) : null;
  const distratoAssinadoUrl = distratoAssinado ? await getSignedUrl(distratoAssinado.arquivo_path) : null;

  return (
    <div className="max-w-3xl">
      <Link href="/rh" className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70">
        <ArrowLeft size={14} />
        Voltar para a visão geral
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--ink-000)]">
            {desligamento.colaborador?.nome}
          </h1>
          <p className="mt-1 text-sm text-white/40">
            {desligamento.colaborador?.cargo ?? "Sem cargo informado"} · conversa em{" "}
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

      {/* Dados do colaborador */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Dados do colaborador</CardTitle>
        </CardHeader>
        <CardBody>
          <form action={atualizarCpfAction} className="flex items-end gap-3">
            <input type="hidden" name="colaborador_id" value={desligamento.colaborador_id} />
            <input type="hidden" name="desligamento_id" value={desligamento.id} />
            <div className="max-w-xs flex-1">
              <Field label="CPF" hint="Necessário para a elaboração do distrato">
                <Input
                  name="cpf"
                  defaultValue={desligamento.colaborador?.cpf ?? ""}
                  placeholder="000.000.000-00"
                />
              </Field>
            </div>
            <Button type="submit" size="sm" variant="secondary">
              <IdCard size={15} />
              Salvar CPF
            </Button>
          </form>
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
          <div className="flex gap-2">
            <Pill tone={acordo?.tem_multa ? "warn" : "neutral"}>
              {acordo?.tem_multa
                ? `Com multa · ${acordo.multa_responsavel === "empresa" ? "FI paga" : "colaborador paga"}`
                : "Sem multa"}
            </Pill>
            <Pill tone={acordo?.tem_acordo ? "accent" : "neutral"}>
              {acordo?.tem_acordo ? "Com acordo específico" : "Sem acordo específico"}
            </Pill>
          </div>
          {acordo?.condicoes && <p className="text-white/70">{acordo.condicoes}</p>}
        </CardBody>
      </Card>

      {/* Valores financeiros */}
      <Card className="mb-5">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Valores (financeiro)</CardTitle>
          {!valores && status === "enviado_rh" && (
            <form action={encaminharFinanceiroAction.bind(null, desligamento.id)}>
              <Button size="sm" variant="secondary" type="submit">
                Encaminhar ao financeiro
              </Button>
            </form>
          )}
        </CardHeader>
        <CardBody className="text-sm">
          {valores ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-white/40 text-xs">Salário base</p>
                <p className="text-white/85">{formatBRL(valores.salario_base)}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Dias trabalhados</p>
                <p className="text-white/85">{valores.dias_trabalhados}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Multa + acordo</p>
                <p className="text-white/85">{formatBRL(valores.valor_multa + valores.valor_acordo)}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Valor total</p>
                <p className="font-display text-[var(--blue-400)]">{formatBRL(valores.valor_total)}</p>
              </div>
            </div>
          ) : (
            <p className="text-white/40">Aguardando o financeiro informar os valores.</p>
          )}
        </CardBody>
      </Card>

      {/* Solicitação ao advogado */}
      {(status === "enviado_rh" || status === "dados_financeiros_pendentes") && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Solicitar distrato ao advogado</CardTitle>
          </CardHeader>
          <CardBody>
            <form action={solicitarAdvogadoAction} className="space-y-4">
              <input type="hidden" name="desligamento_id" value={desligamento.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome do advogado">
                  <Input name="advogado_nome" required placeholder="Nome completo" />
                </Field>
                <Field label="E-mail do advogado">
                  <Input type="email" name="advogado_email" required placeholder="advogado@escritorio.com" />
                </Field>
              </div>
              <Field label="Observações" hint="Opcional — qualquer instrução adicional para o advogado">
                <Textarea name="observacoes" />
              </Field>
              <Button type="submit">
                <Send size={15} />
                Enviar solicitação por e-mail
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      {solicitacao && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Solicitação enviada</CardTitle>
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
            <p>
              <span className="text-white/40">Link único: </span>
              <span className="font-mono-label text-xs text-white/50">
                /distrato/{solicitacao.token}
              </span>
            </p>
          </CardBody>
        </Card>
      )}

      {/* Conferência da minuta */}
      {minuta && status === "em_conferencia_rh" && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Conferir distrato recebido</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-white/60">
              Documento recebido em {formatDateTime(minuta.uploaded_at)} — arquivo:{" "}
              <span className="font-mono-label text-xs">{minuta.arquivo_path}</span>
            </p>
            {minutaUrl && (
              <a
                href={minutaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--blue-400)] hover:underline"
              >
                <FileText size={14} />
                Ver arquivo
              </a>
            )}
            <form action={conferirDistratoAction} className="space-y-3">
              <input type="hidden" name="documento_id" value={minuta.id} />
              <input type="hidden" name="desligamento_id" value={desligamento.id} />
              <Field label="Observações da conferência" hint="Opcional">
                <Textarea name="observacoes" />
              </Field>
              <div className="flex gap-3">
                <Button type="submit" name="decisao" value="aprovar">
                  <FileCheck2 size={15} />
                  Aprovar e liberar para assinatura
                </Button>
                <Button type="submit" name="decisao" value="rejeitar" variant="secondary">
                  Solicitar revisão ao advogado
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Upload do distrato assinado */}
      {status === "disponivel_assinatura" && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Anexar distrato assinado</CardTitle>
          </CardHeader>
          <CardBody>
            <form action={uploadDistratoAssinadoAction} className="space-y-4">
              <input type="hidden" name="desligamento_id" value={desligamento.id} />
              <Field label="PDF assinado por todas as partes">
                <Input type="file" name="arquivo" accept="application/pdf" required />
              </Field>
              <Button type="submit">
                <Upload size={15} />
                Confirmar assinatura e seguir para procedimentos
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      {distratoAssinado && (
        <Card className="mb-5">
          <CardBody className="space-y-3 text-sm text-white/60">
            <div className="flex items-center justify-between">
              <span>Distrato assinado anexado em {formatDateTime(distratoAssinado.uploaded_at)}.</span>
              {distratoAssinadoUrl && (
                <a
                  href={distratoAssinadoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[var(--blue-400)] hover:underline"
                >
                  <FileText size={14} />
                  Ver arquivo
                </a>
              )}
            </div>
            {solicitacao && (
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
                {solicitacao.distrato_assinado_enviado_em ? (
                  <span className="text-xs text-white/40">
                    Enviado ao advogado em {formatDateTime(solicitacao.distrato_assinado_enviado_em)}.
                  </span>
                ) : (
                  <span className="text-xs text-white/40">Ainda não enviado ao advogado.</span>
                )}
                <form action={enviarDistratoAdvogadoAction}>
                  <input type="hidden" name="desligamento_id" value={desligamento.id} />
                  <input type="hidden" name="documento_id" value={distratoAssinado.id} />
                  <Button type="submit" size="sm" variant="secondary">
                    <Mail size={14} />
                    {solicitacao.distrato_assinado_enviado_em ? "Reenviar ao advogado" : "Enviar ao advogado"}
                  </Button>
                </form>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Procedimentos administrativos */}
      {(status === "procedimentos_em_andamento" ||
        status === "aguardando_pagamento" ||
        status === "pago") && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Procedimentos administrativos</CardTitle>
          </CardHeader>
          <CardBody>
            <form action={atualizarProcedimentosAction} className="space-y-4">
              <input type="hidden" name="desligamento_id" value={desligamento.id} />
              <div className="space-y-3">
                <Checkbox
                  name="materiais_recolhidos"
                  label="Materiais da empresa recolhidos"
                  defaultChecked={procedimentos?.materiais_recolhidos}
                  disabled={status !== "procedimentos_em_andamento"}
                />
                <Checkbox
                  name="acessos_bloqueados"
                  label="Acessos aos sistemas bloqueados/removidos"
                  defaultChecked={procedimentos?.acessos_bloqueados}
                  disabled={status !== "procedimentos_em_andamento"}
                />
                <Checkbox
                  name="beneficios_cancelados"
                  label="Plano de saúde e benefícios cancelados"
                  defaultChecked={procedimentos?.beneficios_cancelados}
                  disabled={status !== "procedimentos_em_andamento"}
                />
                {status === "procedimentos_em_andamento" && (
                  <Checkbox name="nf_necessaria" label="Este caso exige Nota Fiscal para o pagamento" />
                )}
              </div>
              {status === "procedimentos_em_andamento" && (
                <Button type="submit" size="sm">
                  <ClipboardCheck size={15} />
                  Salvar procedimentos
                </Button>
              )}
            </form>
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
              {formatDate(pagamento.data_prevista)} (5º dia útil)
            </p>
            <p>
              <span className="text-white/40">NF necessária: </span>
              {pagamento.nf_necessaria ? "Sim" : "Não"}
            </p>
            {pagamento.nf_necessaria && !pagamento.nf_emitida && (
              <div className="space-y-2 rounded-lg border border-white/10 bg-[var(--midnight)]/40 p-3">
                <p className="text-white/60">
                  A emissão da NF é feita pelo colaborador, através de um link único. Copie e envie
                  para ele pelo canal que preferir (e-mail, WhatsApp etc.).
                </p>
                {solicitacaoNf ? (
                  <p>
                    <span className="text-white/40">Link: </span>
                    <span className="font-mono-label text-xs text-white/50">
                      /nota-fiscal/{solicitacaoNf.token}
                    </span>
                  </p>
                ) : (
                  <p className="text-white/40">Nenhum link gerado ainda.</p>
                )}
                <form action={gerarLinkNfAction}>
                  <input type="hidden" name="desligamento_id" value={desligamento.id} />
                  <Button type="submit" size="sm" variant="secondary">
                    {solicitacaoNf ? "Gerar novo link" : "Gerar link para o colaborador"}
                  </Button>
                </form>
              </div>
            )}
            {pagamento.nf_necessaria && pagamento.nf_emitida && (
              <p>
                <span className="text-white/40">NF: </span>
                Recebida ({pagamento.nf_numero})
              </p>
            )}
            <p>
              <span className="text-white/40">Status: </span>
              {pagamento.status === "pago" ? "Pago" : "Aguardando financeiro"}
            </p>
            <p className="text-xs text-white/35 pt-1">
              Registro do pagamento é feito pelo Financeiro.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Cancelamento */}
      {status !== "pago" && status !== "cancelado" && (
        <form action={cancelarDesligamentoAction} className="mt-8">
          <input type="hidden" name="desligamento_id" value={desligamento.id} />
          <Button type="submit" variant="danger" size="sm">
            <Ban size={14} />
            Cancelar processo
          </Button>
        </form>
      )}
    </div>
  );
}