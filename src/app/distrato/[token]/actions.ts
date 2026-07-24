"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// Rota sem autenticação Supabase — a única "senha" é o token na URL.
// Por isso usamos exclusivamente a service role aqui, nunca a anon key,
// e validamos manualmente cada passo antes de tocar no banco.

export async function buscarSolicitacaoPorToken(token: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("solicitacoes_advogado")
    .select("*, desligamento:desligamentos(id, status, colaborador:colaboradores(nome, cargo))")
    .eq("token", token)
    .single();

  if (error || !data) return null;
  return data;
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
    return { ok: false as const, message: "Selecione o arquivo PDF do distrato." };
  }
  if (file.type !== "application/pdf") {
    return { ok: false as const, message: "Envie o distrato em formato PDF." };
  }

 const path = `${solicitacao.desligamento_id}/minuta-${Date.now()}.pdf`;
  const { error: uploadError } = await admin.storage
    .from("distratos")
    .upload(path, file, { contentType: "application/pdf" });
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

  return { ok: true as const, message: "Distrato enviado. O RH foi notificado para conferência." };
}
