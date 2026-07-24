"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { addBusinessDays } from "@/lib/utils";
import { sendEmail, emailSolicitacaoAdvogado } from "@/lib/email";

export async function encaminharFinanceiroAction(desligamentoId: string) {
  await requireRole(["rh", "admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("desligamentos")
    .update({ status: "dados_financeiros_pendentes" })
    .eq("id", desligamentoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/rh/${desligamentoId}`);
}

export async function solicitarAdvogadoAction(formData: FormData) {
  const profile = await requireRole(["rh", "admin"]);
  const supabase = await createClient();

  const desligamentoId = String(formData.get("desligamento_id"));
  const advogadoNome = String(formData.get("advogado_nome") ?? "").trim();
  const advogadoEmail = String(formData.get("advogado_email") ?? "").trim();
  const observacoes = String(formData.get("observacoes") ?? "").trim() || null;

  const { data: desligamento } = await supabase
    .from("desligamentos")
    .select("*, colaborador:colaboradores(*), acordo:acordos(*), valores:valores_financeiros(*)")
    .eq("id", desligamentoId)
    .single();

  if (!desligamento) throw new Error("Desligamento não encontrado.");

  const prazoLimite = addBusinessDays(new Date(), 2).toISOString().slice(0, 10);

  const dadosEnviados = {
    colaborador: desligamento.colaborador?.nome,
    cargo: desligamento.colaborador?.cargo,
    motivo: desligamento.motivo,
    condicoes: desligamento.acordo?.[0]?.condicoes ?? null,
    tem_multa: desligamento.acordo?.[0]?.tem_multa ?? false,
    tem_acordo: desligamento.acordo?.[0]?.tem_acordo ?? false,
    valor_total: desligamento.valores?.[0]?.valor_total ?? null,
  };

  const { data: solicitacao, error } = await supabase
    .from("solicitacoes_advogado")
    .insert({
      desligamento_id: desligamentoId,
      advogado_nome: advogadoNome,
      advogado_email: advogadoEmail,
      prazo_limite: prazoLimite,
      dados_enviados: dadosEnviados,
      observacoes,
    })
    .select()
    .single();

  if (error || !solicitacao) throw new Error(error?.message ?? "Falha ao criar solicitação.");

  const { error: statusError } = await supabase
    .from("desligamentos")
    .update({ status: "aguardando_distrato" })
    .eq("id", desligamentoId);
  if (statusError) throw new Error(statusError.message);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/distrato/${solicitacao.token}`;

  await sendEmail({
    to: advogadoEmail,
    subject: `Solicitação de distrato — ${dadosEnviados.colaborador}`,
    html: emailSolicitacaoAdvogado({
      advogadoNome,
      colaboradorNome: dadosEnviados.colaborador ?? "colaborador",
      link,
      condicoes: dadosEnviados.condicoes,
      temMulta: dadosEnviados.tem_multa,
      temAcordo: dadosEnviados.tem_acordo,
      valorTotal: dadosEnviados.valor_total,
      prazoLimite,
    }),
  });

  void profile;
  revalidatePath(`/rh/${desligamentoId}`);
}

export async function conferirDistratoAction(formData: FormData) {
  await requireRole(["rh", "admin"]);
  const supabase = await createClient();

  const documentoId = String(formData.get("documento_id"));
  const desligamentoId = String(formData.get("desligamento_id"));
  const decisao = String(formData.get("decisao")); // "aprovar" | "rejeitar"
  const observacoes = String(formData.get("observacoes") ?? "").trim() || null;

  if (decisao === "aprovar") {
    await supabase
      .from("documentos")
      .update({ status: "aprovado", observacoes_conferencia: observacoes })
      .eq("id", documentoId);
    await supabase
      .from("desligamentos")
      .update({ status: "disponivel_assinatura" })
      .eq("id", desligamentoId);
  } else {
    await supabase
      .from("documentos")
      .update({ status: "rejeitado", observacoes_conferencia: observacoes })
      .eq("id", documentoId);
    // Reabre o link do advogado (sem expiração — só invalida quando usado)
    await supabase
      .from("solicitacoes_advogado")
      .update({ usado_em: null })
      .eq("desligamento_id", desligamentoId);
    await supabase
      .from("desligamentos")
      .update({ status: "aguardando_distrato" })
      .eq("id", desligamentoId);
  }

  revalidatePath(`/rh/${desligamentoId}`);
}

export async function uploadDistratoAssinadoAction(formData: FormData) {
  const profile = await requireRole(["rh", "admin"]);
  const supabase = await createClient();
  const admin = createAdminClient();

  const desligamentoId = String(formData.get("desligamento_id"));
  const file = formData.get("arquivo") as File | null;
  if (!file || file.size === 0) throw new Error("Selecione o PDF do distrato assinado.");

  const path = `${desligamentoId}/distrato-assinado-${Date.now()}.pdf`;
  const { error: uploadError } = await admin.storage
    .from("distratos")
    .upload(path, file, { contentType: "application/pdf" });
  if (uploadError) throw new Error(uploadError.message);

  const { error: docError } = await supabase.from("documentos").insert({
    desligamento_id: desligamentoId,
    tipo: "distrato_assinado",
    arquivo_path: path,
    status: "aprovado",
    uploaded_by: profile.id,
  });
  if (docError) throw new Error(docError.message);

  const { error: statusError } = await supabase
    .from("desligamentos")
    .update({ status: "procedimentos_em_andamento" })
    .eq("id", desligamentoId);
  if (statusError) throw new Error(statusError.message);

  await supabase.from("procedimentos").upsert(
    { desligamento_id: desligamentoId },
    { onConflict: "desligamento_id", ignoreDuplicates: true }
  );

  revalidatePath(`/rh/${desligamentoId}`);
}

export async function atualizarProcedimentosAction(formData: FormData) {
  const profile = await requireRole(["rh", "admin"]);
  const supabase = await createClient();

  const desligamentoId = String(formData.get("desligamento_id"));
  const materiais = formData.get("materiais_recolhidos") === "on";
  const acessos = formData.get("acessos_bloqueados") === "on";
  const beneficios = formData.get("beneficios_cancelados") === "on";
  const nfNecessaria = formData.get("nf_necessaria") === "on";

  const todosConcluidos = materiais && acessos && beneficios;

  const { error } = await supabase.from("procedimentos").upsert(
    {
      desligamento_id: desligamentoId,
      materiais_recolhidos: materiais,
      acessos_bloqueados: acessos,
      beneficios_cancelados: beneficios,
      concluido_por: todosConcluidos ? profile.id : null,
      concluido_em: todosConcluidos ? new Date().toISOString() : null,
    },
    { onConflict: "desligamento_id" }
  );
  if (error) throw new Error(error.message);

  if (todosConcluidos) {
    await supabase
      .from("desligamentos")
      .update({ status: "aguardando_pagamento" })
      .eq("id", desligamentoId);

    const dataPrevista = addBusinessDays(new Date(), 5).toISOString().slice(0, 10);
    await supabase.from("pagamentos").upsert(
      { desligamento_id: desligamentoId, nf_necessaria: nfNecessaria, data_prevista: dataPrevista },
      { onConflict: "desligamento_id", ignoreDuplicates: true }
    );
  }

  revalidatePath(`/rh/${desligamentoId}`);
}

export async function gerarLinkNfAction(formData: FormData) {
  await requireRole(["rh", "admin"]);
  const supabase = await createClient();

  const desligamentoId = String(formData.get("desligamento_id"));

  const { data: desligamento } = await supabase
    .from("desligamentos")
    .select("*, colaborador:colaboradores(*), valores:valores_financeiros(*)")
    .eq("id", desligamentoId)
    .single();

  if (!desligamento) throw new Error("Desligamento não encontrado.");

  const dadosEnviados = {
    colaborador: desligamento.colaborador?.nome,
    valor_total: desligamento.valores?.[0]?.valor_total ?? null,
  };

  const { error } = await supabase.from("solicitacoes_nf").insert({
    desligamento_id: desligamentoId,
    colaborador_email: desligamento.colaborador?.email ?? "",
    dados_enviados: dadosEnviados,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/rh/${desligamentoId}`);
  revalidatePath(`/financeiro/${desligamentoId}`);
}

export async function cancelarDesligamentoAction(formData: FormData) {
  await requireRole(["rh", "admin"]);
  const supabase = await createClient();
  const desligamentoId = String(formData.get("desligamento_id"));

  const { error } = await supabase
    .from("desligamentos")
    .update({ status: "cancelado" })
    .eq("id", desligamentoId);
  if (error) throw new Error(error.message);

  redirect("/rh");
}
