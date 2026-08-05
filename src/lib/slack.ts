// Notificações no Slack para as principais ações do fluxo de desligamento.
// Usa um Incoming Webhook do Slack (uma única URL, configurada em
// SLACK_WEBHOOK_URL) — não precisa de app instalado no workspace.
//
// Importante: falha ao notificar o Slack NUNCA deve travar a ação principal
// do usuário (registrar desligamento, anexar distrato etc.). Por isso todo
// erro aqui é só logado — nunca lançado (sem "throw").

import { formatBRL } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function sendSlackMessage(text: string) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn(`[slack] SLACK_WEBHOOK_URL não configurada — notificação não enviada:\n${text}`);
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      console.error(`[slack] Falha ao enviar notificação (${response.status}): ${await response.text()}`);
    }
  } catch (err) {
    console.error("[slack] Erro ao enviar notificação:", err);
  }
}

// Helper usado pelas actions que ainda não têm o nome do colaborador em mãos
// no momento de notificar (evita repetir a mesma query em cada uma).
export async function nomeColaboradorPorDesligamento(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- aceita tanto o client "por usuário" quanto o admin (service role); a forma dos dados é validada abaixo, não confiada ao tipo.
  supabase: SupabaseClient<any, "public", "public", any, any>,
  desligamentoId: string
): Promise<string> {
  const { data } = await supabase
    .from("desligamentos")
    .select("colaborador:colaboradores(nome)")
    .eq("id", desligamentoId)
    .single();
  const colaboradorRaw = (data as { colaborador?: { nome?: string } | { nome?: string }[] } | null)
    ?.colaborador;
  const colaborador = Array.isArray(colaboradorRaw) ? colaboradorRaw[0] : colaboradorRaw;
  return colaborador?.nome ?? "colaborador";
}

export function notificarNovoDesligamento(params: {
  colaboradorNome: string;
  gestorNome: string;
  desligamentoId: string;
}) {
  return sendSlackMessage(
    `🆕 *Novo desligamento registrado*\n` +
      `*Colaborador:* ${params.colaboradorNome}\n` +
      `*Registrado por:* ${params.gestorNome}\n` +
      `<${baseUrl()}/rh/${params.desligamentoId}|Ver no sistema>`
  );
}

export function notificarSolicitacaoAdvogado(params: {
  colaboradorNome: string;
  advogadoNome: string;
  desligamentoId: string;
}) {
  return sendSlackMessage(
    `⚖️ *Distrato solicitado ao advogado*\n` +
      `*Colaborador:* ${params.colaboradorNome}\n` +
      `*Advogado:* ${params.advogadoNome}\n` +
      `<${baseUrl()}/rh/${params.desligamentoId}|Ver no sistema>`
  );
}

export function notificarMinutaRecebida(params: { colaboradorNome: string; desligamentoId: string }) {
  return sendSlackMessage(
    `📄 *Minuta do distrato recebida — aguardando conferência do RH*\n` +
      `*Colaborador:* ${params.colaboradorNome}\n` +
      `<${baseUrl()}/rh/${params.desligamentoId}|Conferir agora>`
  );
}

export function notificarDistratoAprovado(params: { colaboradorNome: string; desligamentoId: string }) {
  return sendSlackMessage(
    `✅ *Distrato aprovado — liberado para assinatura*\n` +
      `*Colaborador:* ${params.colaboradorNome}\n` +
      `<${baseUrl()}/rh/${params.desligamentoId}|Ver no sistema>`
  );
}

export function notificarRevisaoSolicitada(params: { colaboradorNome: string; desligamentoId: string }) {
  return sendSlackMessage(
    `🔁 *Revisão do distrato solicitada ao advogado*\n` +
      `*Colaborador:* ${params.colaboradorNome}\n` +
      `<${baseUrl()}/rh/${params.desligamentoId}|Ver no sistema>`
  );
}

export function notificarDistratoAssinado(params: { colaboradorNome: string; desligamentoId: string }) {
  return sendSlackMessage(
    `✍️ *Distrato assinado anexado — seguindo para procedimentos*\n` +
      `*Colaborador:* ${params.colaboradorNome}\n` +
      `<${baseUrl()}/rh/${params.desligamentoId}|Ver no sistema>`
  );
}

export function notificarProcedimentosConcluidos(params: { colaboradorNome: string; desligamentoId: string }) {
  return sendSlackMessage(
    `📋 *Procedimentos administrativos concluídos — aguardando pagamento*\n` +
      `*Colaborador:* ${params.colaboradorNome}\n` +
      `<${baseUrl()}/financeiro/${params.desligamentoId}|Ver no financeiro>`
  );
}

export function notificarNfAnexada(params: {
  colaboradorNome: string;
  nfNumero: string;
  desligamentoId: string;
}) {
  return sendSlackMessage(
    `🧾 *Nota fiscal anexada*\n` +
      `*Colaborador:* ${params.colaboradorNome}\n` +
      `*NF:* ${params.nfNumero}\n` +
      `<${baseUrl()}/financeiro/${params.desligamentoId}|Ver no sistema>`
  );
}

export function notificarPagamentoRegistrado(params: {
  colaboradorNome: string;
  valor: number;
  concluido: boolean;
  desligamentoId: string;
}) {
  const titulo = params.concluido ? "💰 *Pagamento concluído*" : "💸 *Parcela de pagamento registrada*";
  return sendSlackMessage(
    `${titulo}\n` +
      `*Colaborador:* ${params.colaboradorNome}\n` +
      `*Valor:* ${formatBRL(params.valor)}\n` +
      `<${baseUrl()}/financeiro/${params.desligamentoId}|Ver no sistema>`
  );
}

export function notificarCancelamento(params: { colaboradorNome: string; desligamentoId: string }) {
  return sendSlackMessage(
    `🚫 *Processo de desligamento cancelado*\n` +
      `*Colaborador:* ${params.colaboradorNome}\n` +
      `<${baseUrl()}/rh/${params.desligamentoId}|Ver no sistema>`
  );
}