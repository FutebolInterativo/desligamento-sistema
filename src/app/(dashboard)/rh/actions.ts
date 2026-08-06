"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { addBusinessDays } from "@/lib/utils";
import { sendEmail, emailSolicitacaoAdvogado, emailDistratoAssinado, emailSolicitarRevisaoDistrato } from "@/lib/email";
import {
  nomeColaboradorPorDesligamento,
  notificarSolicitacaoAdvogado,
  notificarDistratoAprovado,
  notificarRevisaoSolicitada,
  notificarDistratoAssinado,
  notificarProcedimentosConcluidos,
  notificarNfAnexada,
  notificarCancelamento,
} from "@/lib/slack";

export async function atualizarCpfAction(formData: FormData) {
  await requireRole(["rh", "admin"]);
  const supabase = await createClient();

  const colaboradorId = String(formData.get("colaborador_id"));
  const desligamentoId = String(formData.get("desligamento_id"));
  const cpf = String(formData.get("cpf") ?? "").trim() || null;

  const { error } = await supabase
    .from("colaboradores")
    .update({ cpf })
    .eq("id", colaboradorId);
  if (error) throw new Error(error.message);

  revalidatePath(`/rh/${desligamentoId}`);
}

export async function enviarDistratoAdvogadoAction(formData: FormData) {
  await requireRole(["rh", "admin"]);
  const supabase = await createClient();
  const admin = createAdminClient();

  const desligamentoId = String(formData.get("desligamento_id"));
  const documentoId = String(formData.get("documento_id"));

  const { data: documento } = await supabase
    .from("documentos")
    .select("*")
    .eq("id", documentoId)
    .single();
  if (!documento) throw new Error("Documento não encontrado.");

  const { data: solicitacao } = await supabase
    .from("solicitacoes_advogado")
    .select("*")
    .eq("desligamento_id", desligamentoId)
    .order("solicitado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!solicitacao) {
    throw new Error("Não há solicitação ao advogado registrada para este desligamento.");
  }

  const { data: desligamento } = await supabase
    .from("desligamentos")
    .select("*, colaborador:colaboradores(*)")
    .eq("id", desligamentoId)
    .single();
  if (!desligamento) throw new Error("Desligamento não encontrado.");

  const { data: fileBlob, error: downloadError } = await admin.storage
    .from("distratos")
    .download(documento.arquivo_path);
  if (downloadError || !fileBlob) {
    throw new Error(downloadError?.message ?? "Não foi possível baixar o arquivo do distrato.");
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer());

  await sendEmail({
    to: solicitacao.advogado_email,
    subject: `Distrato assinado — ${desligamento.colaborador?.nome ?? "colaborador"}`,
    html: emailDistratoAssinado({
      advogadoNome: solicitacao.advogado_nome,
      colaboradorNome: desligamento.colaborador?.nome ?? "colaborador",
    }),
    attachments: [
      { filename: "distrato-assinado.pdf", content: buffer.toString("base64") },
    ],
  });

  const { error } = await supabase
    .from("solicitacoes_advogado")
    .update({ distrato_assinado_enviado_em: new Date().toISOString() })
    .eq("id", solicitacao.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/rh/${desligamentoId}`);
}

export async function solicitarAdvogadoAction(formData: FormData) {
  const profile = await requireRole(["rh", "admin"]);
  const supabase = await createClient();
  const admin = createAdminClient();

  const desligamentoId = String(formData.get("desligamento_id"));
  const advogadoNome = String(formData.get("advogado_nome") ?? "").trim();
  const advogadoEmail = String(formData.get("advogado_email") ?? "").trim();
  const observacoes = String(formData.get("observacoes") ?? "").trim() || null;
  const contratoAtual = formData.get("contrato_atual") as File | null;

  if (!contratoAtual || contratoAtual.size === 0) {
    throw new Error("Anexe o contrato atual do colaborador antes de enviar ao advogado.");
  }

  const { data: desligamento } = await supabase
    .from("desligamentos")
    .select("*, colaborador:colaboradores(*)")
    .eq("id", desligamentoId)
    .single();

  if (!desligamento) throw new Error("Desligamento não encontrado.");

  // Busca separada (em vez de embed) pra não depender de nenhuma inferência
  // de relacionamento — mais direto e mais fácil de garantir que pega a
  // linha certa.
  const { data: acordo } = await supabase
    .from("acordos")
    .select("*")
    .eq("desligamento_id", desligamentoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: valores } = await supabase
    .from("valores_financeiros")
    .select("*")
    .eq("desligamento_id", desligamentoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prazoLimite = addBusinessDays(new Date(), 2).toISOString().slice(0, 10);

  const dadosEnviados = {
    colaborador: desligamento.colaborador?.nome,
    cargo: desligamento.colaborador?.cargo,
    cpf: desligamento.colaborador?.cpf,
    tipo_vinculo: desligamento.colaborador?.tipo_vinculo,
    data_conversa: desligamento.data_conversa,
    data_ultimo_dia_trabalhado: desligamento.data_ultimo_dia_trabalhado,
    motivo: desligamento.motivo,
    condicoes: acordo?.condicoes ?? null,
    tem_multa: acordo?.tem_multa ?? false,
    multa_responsavel: acordo?.multa_responsavel ?? null,
    tem_acordo: acordo?.tem_acordo ?? false,
    salario_base: valores?.salario_base != null ? Number(valores.salario_base) : null,
    dias_trabalhados: valores?.dias_trabalhados != null ? Number(valores.dias_trabalhados) : null,
    valor_multa: valores?.valor_multa != null ? Number(valores.valor_multa) : null,
    valor_acordo: valores?.valor_acordo != null ? Number(valores.valor_acordo) : null,
    valor_total: valores?.valor_total != null ? Number(valores.valor_total) : null,
  };

  // Sobe o contrato atual e registra como documento do caso — fica
  // disponível na tela do RH assim como os outros documentos (minuta,
  // distrato assinado, NF).
  const contratoPath = `${desligamentoId}/contrato-atual-${Date.now()}.pdf`;
  const { error: uploadError } = await admin.storage
    .from("distratos")
    .upload(contratoPath, contratoAtual, { contentType: "application/pdf" });
  if (uploadError) throw new Error(uploadError.message);

  const { error: docError } = await supabase.from("documentos").insert({
    desligamento_id: desligamentoId,
    tipo: "contrato_atual",
    arquivo_path: contratoPath,
    status: "aprovado",
    uploaded_by: profile.id,
  });
  if (docError) throw new Error(docError.message);

  const contratoBuffer = Buffer.from(await contratoAtual.arrayBuffer());

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
      link,
      prazoLimite,
      observacoes,
      dados: dadosEnviados,
    }),
    attachments: [
      { filename: "contrato-atual.pdf", content: contratoBuffer.toString("base64") },
    ],
  });

  await notificarSolicitacaoAdvogado({
    colaboradorNome: dadosEnviados.colaborador ?? "colaborador",
    advogadoNome,
    desligamentoId,
  });

  void profile;
  revalidatePath(`/rh/${desligamentoId}`);
}

export async function reenviarLembreteAdvogadoAction(formData: FormData) {
  await requireRole(["rh", "admin"]);
  const supabase = await createClient();

  const desligamentoId = String(formData.get("desligamento_id"));

  const { data: desligamento } = await supabase
    .from("desligamentos")
    .select("*, colaborador:colaboradores(*)")
    .eq("id", desligamentoId)
    .single();
  if (!desligamento) throw new Error("Desligamento não encontrado.");

  const { data: solicitacao } = await supabase
    .from("solicitacoes_advogado")
    .select("*")
    .eq("desligamento_id", desligamentoId)
    .order("solicitado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!solicitacao) {
    throw new Error("Não há solicitação ao advogado registrada para este desligamento.");
  }

  // Reaproveita o mesmo token e os mesmos dados já enviados originalmente —
  // só remonta o link com a URL base atual (útil se o domínio do app mudou
  // depois do envio original) e reenvia o mesmo e-mail, com o contrato
  // atual reanexado (se esse caso já tiver um — casos criados antes desta
  // funcionalidade existir podem não ter).
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/distrato/${solicitacao.token}`;
  const dadosEnviados = solicitacao.dados_enviados as Parameters<typeof emailSolicitacaoAdvogado>[0]["dados"];

  const { data: contratoDoc } = await supabase
    .from("documentos")
    .select("arquivo_path")
    .eq("desligamento_id", desligamentoId)
    .eq("tipo", "contrato_atual")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let attachments: { filename: string; content: string }[] | undefined;
  if (contratoDoc) {
    const admin = createAdminClient();
    const { data: fileBlob } = await admin.storage.from("distratos").download(contratoDoc.arquivo_path);
    if (fileBlob) {
      const buffer = Buffer.from(await fileBlob.arrayBuffer());
      attachments = [{ filename: "contrato-atual.pdf", content: buffer.toString("base64") }];
    }
  }

  await sendEmail({
    to: solicitacao.advogado_email,
    subject: `Lembrete: Solicitação de distrato — ${dadosEnviados?.colaborador ?? desligamento.colaborador?.nome ?? "colaborador"}`,
    html: emailSolicitacaoAdvogado({
      advogadoNome: solicitacao.advogado_nome,
      link,
      prazoLimite: solicitacao.prazo_limite,
      observacoes: solicitacao.observacoes,
      dados: dadosEnviados ?? {},
    }),
    ...(attachments ? { attachments } : {}),
  });

  const { error } = await supabase
    .from("solicitacoes_advogado")
    .update({ lembrete_enviado_em: new Date().toISOString() })
    .eq("id", solicitacao.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/rh/${desligamentoId}`);
}

export async function conferirDistratoAction(formData: FormData) {
  await requireRole(["rh", "admin"]);
  const supabase = await createClient();

  const documentoId = String(formData.get("documento_id"));
  const desligamentoId = String(formData.get("desligamento_id"));
  const decisao = String(formData.get("decisao")); // "aprovar" | "rejeitar"
  const observacoes = String(formData.get("observacoes") ?? "").trim() || null;

  const colaboradorNome = await nomeColaboradorPorDesligamento(supabase, desligamentoId);

  if (decisao === "aprovar") {
    await supabase
      .from("documentos")
      .update({ status: "aprovado", observacoes_conferencia: observacoes })
      .eq("id", documentoId);
    await supabase
      .from("desligamentos")
      .update({ status: "disponivel_assinatura" })
      .eq("id", desligamentoId);

    await notificarDistratoAprovado({ colaboradorNome, desligamentoId });
  } else {
    await supabase
      .from("documentos")
      .update({ status: "rejeitado", observacoes_conferencia: observacoes })
      .eq("id", documentoId);

    const { data: solicitacao } = await supabase
      .from("solicitacoes_advogado")
      .select("*")
      .eq("desligamento_id", desligamentoId)
      .order("solicitado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Reabre o link do advogado (sem expiração — só invalida quando usado)
    if (solicitacao) {
      await supabase
        .from("solicitacoes_advogado")
        .update({ usado_em: null })
        .eq("id", solicitacao.id);
    }

    await supabase
      .from("desligamentos")
      .update({ status: "aguardando_distrato" })
      .eq("id", desligamentoId);

    if (solicitacao) {
      const { data: desligamento } = await supabase
        .from("desligamentos")
        .select("*, colaborador:colaboradores(*)")
        .eq("id", desligamentoId)
        .single();

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const link = `${baseUrl}/distrato/${solicitacao.token}`;

      await sendEmail({
        to: solicitacao.advogado_email,
        subject: `Revisão solicitada no distrato — ${desligamento?.colaborador?.nome ?? "colaborador"}`,
        html: emailSolicitarRevisaoDistrato({
          advogadoNome: solicitacao.advogado_nome,
          colaboradorNome: desligamento?.colaborador?.nome ?? "colaborador",
          link,
          observacoes,
        }),
      });
    }

    await notificarRevisaoSolicitada({ colaboradorNome, desligamentoId });
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

  await notificarDistratoAssinado({
    colaboradorNome: await nomeColaboradorPorDesligamento(supabase, desligamentoId),
    desligamentoId,
  });

  revalidatePath(`/rh/${desligamentoId}`);
}

export async function atualizarProcedimentosAction(formData: FormData) {
  const profile = await requireRole(["rh", "admin"]);
  const supabase = await createClient();

  const desligamentoId = String(formData.get("desligamento_id"));
  const notebook = formData.get("notebook_recolhido") === "on";
  const celular = formData.get("celular_recolhido") === "on";
  const email = formData.get("email_desativado") === "on";
  const slack = formData.get("slack_removido") === "on";
  const documentosContrato = formData.get("documentos_contrato_arquivados") === "on";
  const wellhub = formData.get("wellhub_cancelado") === "on";
  const grupoAvisos = formData.get("grupo_avisos_removido") === "on";
  const alice = formData.get("alice_cancelado") === "on";

  const todosConcluidos =
    notebook && celular && email && slack && documentosContrato && wellhub && grupoAvisos && alice;

  const { error } = await supabase.from("procedimentos").upsert(
    {
      desligamento_id: desligamentoId,
      notebook_recolhido: notebook,
      celular_recolhido: celular,
      email_desativado: email,
      slack_removido: slack,
      documentos_contrato_arquivados: documentosContrato,
      wellhub_cancelado: wellhub,
      grupo_avisos_removido: grupoAvisos,
      alice_cancelado: alice,
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

    // NF só é exigida para vínculo PJ — CLT e Estágio não emitem nota.
    const { data: desligamento } = await supabase
      .from("desligamentos")
      .select("colaborador:colaboradores(nome, tipo_vinculo)")
      .eq("id", desligamentoId)
      .single();
    const colaboradorInfo = Array.isArray(desligamento?.colaborador)
      ? desligamento?.colaborador[0]
      : desligamento?.colaborador;
    const nfNecessaria = colaboradorInfo?.tipo_vinculo === "pj";

    const dataPrevista = addBusinessDays(new Date(), 5).toISOString().slice(0, 10);
    await supabase.from("pagamentos").upsert(
      { desligamento_id: desligamentoId, nf_necessaria: nfNecessaria, data_prevista: dataPrevista },
      { onConflict: "desligamento_id", ignoreDuplicates: true }
    );

    await notificarProcedimentosConcluidos({
      colaboradorNome: colaboradorInfo?.nome ?? "colaborador",
      desligamentoId,
    });
  }

  revalidatePath(`/rh/${desligamentoId}`);
}

export async function anexarNfAction(formData: FormData) {
  const profile = await requireRole(["rh", "admin"]);
  const supabase = await createClient();
  const admin = createAdminClient();

  const desligamentoId = String(formData.get("desligamento_id"));
  const nfNumero = String(formData.get("nf_numero") ?? "").trim() || null;
  const file = formData.get("arquivo") as File | null;
  if (!file || file.size === 0) throw new Error("Selecione o arquivo da nota fiscal.");
  if (!nfNumero) throw new Error("Informe o número da nota fiscal.");

  const path = `${desligamentoId}/nota-fiscal-${Date.now()}.pdf`;
  const { error: uploadError } = await admin.storage
    .from("distratos")
    .upload(path, file, { contentType: "application/pdf" });
  if (uploadError) throw new Error(uploadError.message);

  const { error: docError } = await supabase.from("documentos").insert({
    desligamento_id: desligamentoId,
    tipo: "nota_fiscal",
    arquivo_path: path,
    status: "aprovado",
    uploaded_by: profile.id,
  });
  if (docError) throw new Error(docError.message);

  const { error: pagamentoError } = await supabase
    .from("pagamentos")
    .update({ nf_emitida: true, nf_numero: nfNumero })
    .eq("desligamento_id", desligamentoId);
  if (pagamentoError) throw new Error(pagamentoError.message);

  await notificarNfAnexada({
    colaboradorNome: await nomeColaboradorPorDesligamento(supabase, desligamentoId),
    nfNumero,
    desligamentoId,
  });

  revalidatePath(`/rh/${desligamentoId}`);
  revalidatePath(`/financeiro/${desligamentoId}`);
}

export async function cancelarDesligamentoAction(formData: FormData) {
  await requireRole(["rh", "admin"]);
  const supabase = await createClient();
  const desligamentoId = String(formData.get("desligamento_id"));

  const colaboradorNome = await nomeColaboradorPorDesligamento(supabase, desligamentoId);

  const { error } = await supabase
    .from("desligamentos")
    .update({ status: "cancelado" })
    .eq("id", desligamentoId);
  if (error) throw new Error(error.message);

  await notificarCancelamento({ colaboradorNome, desligamentoId });

  redirect("/rh");
}