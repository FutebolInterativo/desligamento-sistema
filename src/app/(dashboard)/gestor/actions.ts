"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export async function registrarDesligamentoAction(formData: FormData) {
  const profile = await requireRole(["gestor", "rh", "admin"]);
  const supabase = await createClient();

  const nomeColaborador = String(formData.get("nome_colaborador") ?? "").trim();
  const cargo = String(formData.get("cargo") ?? "").trim() || null;
  const tipoVinculo = String(formData.get("tipo_vinculo") ?? "clt");
  const salarioBase = Number(formData.get("salario_base") ?? 0);
  const dataConversa = String(formData.get("data_conversa") ?? "");
  const dataUltimoDia = String(formData.get("data_ultimo_dia") ?? "") || null;
  const motivo = String(formData.get("motivo") ?? "").trim() || null;
  const condicoes = String(formData.get("condicoes") ?? "").trim() || null;
  const temMulta = formData.get("tem_multa") === "on";
  const temAcordo = formData.get("tem_acordo") === "on";
  const multaResponsavel = String(formData.get("multa_responsavel") ?? "").trim() || null;
  const valorMulta = temMulta ? Number(formData.get("valor_multa") ?? 0) : 0;
  const valorAcordo = temAcordo ? Number(formData.get("valor_acordo") ?? 0) : 0;

  if (!nomeColaborador || !dataConversa) {
    throw new Error("Nome do colaborador e data da conversa são obrigatórios.");
  }

  if (!salarioBase || salarioBase <= 0) {
    throw new Error("Informe o salário base do colaborador.");
  }

  if (temMulta && !multaResponsavel) {
    throw new Error("Informe quem paga a multa, já que há multa envolvida.");
  }

  const { data: colaborador, error: colaboradorError } = await supabase
    .from("colaboradores")
    .insert({ nome: nomeColaborador, cargo, tipo_vinculo: tipoVinculo, gestor_id: profile.id })
    .select()
    .single();

  if (colaboradorError || !colaborador) {
    throw new Error(colaboradorError?.message ?? "Não foi possível registrar o colaborador.");
  }

  const { data: desligamento, error: desligamentoError } = await supabase
    .from("desligamentos")
    .insert({
      colaborador_id: colaborador.id,
      gestor_id: profile.id,
      status: "enviado_rh",
      motivo,
      data_conversa: dataConversa,
      data_ultimo_dia_trabalhado: dataUltimoDia,
    })
    .select()
    .single();

  if (desligamentoError || !desligamento) {
    throw new Error(desligamentoError?.message ?? "Não foi possível registrar o desligamento.");
  }

  const { error: acordoError } = await supabase.from("acordos").insert({
    desligamento_id: desligamento.id,
    tem_multa: temMulta,
    multa_responsavel: temMulta ? multaResponsavel : null,
    tem_acordo: temAcordo,
    condicoes,
    registrado_por: profile.id,
  });

  if (acordoError) {
    throw new Error(acordoError.message);
  }

  // Dias úteis/trabalhados ainda não são conhecidos — o próprio Gestor
  // completa isso mais tarde, quando o último dia efetivamente acontece.
  const { error: valoresError } = await supabase.from("valores_financeiros").insert({
    desligamento_id: desligamento.id,
    salario_base: salarioBase,
    dias_trabalhados: null,
    dias_uteis_mes: null,
    valor_multa: valorMulta,
    valor_acordo: valorAcordo,
    multa_responsavel: temMulta ? multaResponsavel : null,
    informado_por: profile.id,
  });

  if (valoresError) {
    throw new Error(valoresError.message);
  }

  redirect("/gestor");
}

// Antes, os "dias trabalhados no mês" eram completados pelo RH (só se sabia
// esse número quando o último dia efetivamente acontecia). Agora isso passa
// a ser responsabilidade do Gestor, junto com um novo campo: os "dias úteis
// no mês" — necessário pra dar contexto ao número de dias trabalhados.
export async function atualizarDiasAction(formData: FormData) {
  const profile = await requireRole(["gestor", "rh", "admin"]);
  const supabase = await createClient();

  const desligamentoId = String(formData.get("desligamento_id") ?? "");
  const diasUteisMes = Number(formData.get("dias_uteis_mes"));
  const diasTrabalhados = Number(formData.get("dias_trabalhados"));

  if (!desligamentoId) {
    throw new Error("Desligamento não informado.");
  }

  if (!diasUteisMes || diasUteisMes <= 0 || diasUteisMes > 31) {
    throw new Error("Informe um número válido de dias úteis no mês.");
  }

  if (!diasTrabalhados || diasTrabalhados <= 0 || diasTrabalhados > 31) {
    throw new Error("Informe um número válido de dias trabalhados.");
  }

  if (diasTrabalhados > diasUteisMes) {
    throw new Error("Dias trabalhados não pode ser maior que dias úteis no mês.");
  }

  // Confirma que o gestor é dono do caso antes de tentar escrever — a RLS já
  // bloqueia no banco, mas aqui dá um erro mais claro em vez de um 403 seco.
  if (profile.role === "gestor") {
    const { data: desligamento } = await supabase
      .from("desligamentos")
      .select("gestor_id")
      .eq("id", desligamentoId)
      .single();
    if (!desligamento || desligamento.gestor_id !== profile.id) {
      throw new Error("Você não tem permissão para editar este desligamento.");
    }
  }

  const { error } = await supabase
    .from("valores_financeiros")
    .update({ dias_uteis_mes: diasUteisMes, dias_trabalhados: diasTrabalhados })
    .eq("desligamento_id", desligamentoId);
  if (error) throw new Error(error.message);

  revalidatePath(`/gestor/${desligamentoId}`);
  revalidatePath(`/rh/${desligamentoId}`);
  revalidatePath(`/financeiro/${desligamentoId}`);
}