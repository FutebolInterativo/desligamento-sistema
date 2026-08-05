"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { notificarMinutaRecebida, nomeColaboradorPorDesligamento } from "@/lib/slack";

// Rota sem autenticação Supabase — a única "senha" é o token na URL.
// Por isso usamos exclusivamente a service role aqui, nunca a anon key,
// e validamos manualmente cada passo antes de tocar no banco.

export async function buscarSolicitacaoPorToken(token: string) {
  const admin = createAdminClient();

  const { data: solicitacao, error } = await admin
    .from("solicitacoes_advogado")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !solicitacao) return null;

  const { data: desligamento } = await admin
    .from("desligamentos")
    .select("id, status, motivo, data_conversa, data_ultimo_dia_trabalhado, colaborador_id")
    .eq("id", solicitacao.desligamento_id)
    .maybeSingle();

  const { data: colaborador } = desligamento
    ? await admin
        .from("colaboradores")
        .select("nome, cargo, cpf, tipo_vinculo")
        .eq("id", desligamento.colaborador_id)
        .maybeSingle()
    : { data: null };

  const { data: acordo } = await admin
    .from("acordos")
    .select("tem_multa, multa_responsavel, tem_acordo, condicoes")
    .eq("desligamento_id", solicitacao.desligamento_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: valoresRaw } = await admin
    .from("valores_financeiros")
    .select("salario_base, dias_trabalhados, valor_multa, valor_acordo, valor_total")
    .eq("desligamento_id", solicitacao.desligamento_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const valores = valoresRaw
    ? {
        salario_base: valoresRaw.salario_base != null ? Number(valoresRaw.salario_base) : null,
        dias_trabalhados: valoresRaw.dias_trabalhados != null ? Number(valoresRaw.dias_trabalhados) : null,
        valor_multa: valoresRaw.valor_multa != null ? Number(valoresRaw.valor_multa) : null,
        valor_acordo: valoresRaw.valor_acordo != null ? Number(valoresRaw.valor_acordo) : null,
        valor_total: valoresRaw.valor_total != null ? Number(valoresRaw.valor_total) : null,
      }
    : null;

  return {
    ...solicitacao,
    desligamento: desligamento ? { ...desligamento, colaborador, acordo: acordo ? [acordo] : [], valores: valores ? [valores] : [] } : null,
  };
}

export async function enviarDistratoAction(formData: FormData) {
  const token = String(formData.get("token"));
  const file = formData.get("arquivo") as File | null;

  const admin = createAdminClient();

  const { data: solicitacao, error } = await admin
    .from("solicitacoes_advogado")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !solicitacao) {
    return { ok: false as const, message: "Link inválido." };
  }
  if (solicitacao.usado_em) {
    return { ok: false as const, message: "Este link já foi utilizado para anexar o distrato." };
  }
  if (!file || file.size === 0) {
    return { ok: false as const, message: "Selecione o arquivo do distrato." };
  }

  const TIPOS_ACEITOS: Record<string, string> = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  };
  const extensao = TIPOS_ACEITOS[file.type];
  if (!extensao) {
    return { ok: false as const, message: "Envie o distrato em formato PDF ou Word (.docx)." };
  }

  const path = `${solicitacao.desligamento_id}/minuta-${Date.now()}.${extensao}`;
  const { error: uploadError } = await admin.storage
    .from("distratos")
    .upload(path, file, { contentType: file.type });
  if (uploadError) {
    console.error("[distrato upload]", uploadError);
    return { ok: false as const, message: `Falha ao enviar o arquivo: ${uploadError.message}` };
  }

  const { error: docError } = await admin.from("documentos").insert({
    desligamento_id: solicitacao.desligamento_id,
    tipo: "minuta_distrato",
    arquivo_path: path,
    status: "pendente",
    uploaded_by_externo: solicitacao.advogado_email,
  });
  if (docError) {
    return { ok: false as const, message: "Falha ao registrar o documento." };
  }

  await admin
    .from("solicitacoes_advogado")
    .update({ usado_em: new Date().toISOString() })
    .eq("token", token);

  await admin
    .from("desligamentos")
    .update({ status: "em_conferencia_rh" })
    .eq("id", solicitacao.desligamento_id);

  await notificarMinutaRecebida({
    colaboradorNome: await nomeColaboradorPorDesligamento(admin, solicitacao.desligamento_id),
    desligamentoId: solicitacao.desligamento_id,
  });

  return { ok: true as const, message: "Distrato enviado. O RH foi notificado para conferência." };
}