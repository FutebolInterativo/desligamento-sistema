"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { nomeColaboradorPorDesligamento, notificarPagamentoRegistrado } from "@/lib/slack";

export async function registrarParcelaAction(
  _prevState: { ok: boolean; message: string } | null,
  formData: FormData
) {
  await requireRole(["financeiro", "admin"]);
  const supabase = await createClient();

  const desligamentoId = String(formData.get("desligamento_id"));
  const valor = Number(formData.get("valor"));
  const dataRealizado = String(formData.get("data_realizado"));

  if (!valor || valor <= 0 || !dataRealizado) {
    return { ok: false as const, message: "Informe o valor e a data da parcela." };
  }

  const { count } = await supabase
    .from("parcelas_pagamento")
    .select("id", { count: "exact", head: true })
    .eq("desligamento_id", desligamentoId);

  // O trigger check_gate_parcela_pagamento bloqueia isto se o distrato não
  // estiver assinado/aprovado, ou se faltar NF quando necessária.
  const { error } = await supabase.from("parcelas_pagamento").insert({
    desligamento_id: desligamentoId,
    numero_parcela: (count ?? 0) + 1,
    valor,
    data_realizado: dataRealizado,
    status: "pago",
  });

  if (error) {
    return {
      ok: false as const,
      message: error.message.includes("Pagamento bloqueado")
        ? error.message
        : `Não foi possível registrar a parcela: ${error.message}`,
    };
  }

  // Se a soma das parcelas pagas já cobre o valor total apurado, conclui o
  // pagamento e avança o status do desligamento.
  const { data: valores } = await supabase
    .from("valores_financeiros")
    .select("valor_total")
    .eq("desligamento_id", desligamentoId)
    .single();

  const { data: parcelas } = await supabase
    .from("parcelas_pagamento")
    .select("valor, status")
    .eq("desligamento_id", desligamentoId);

  const totalPago = (parcelas ?? [])
    .filter((p) => p.status === "pago")
    .reduce((acc, p) => acc + Number(p.valor), 0);

  let concluido = false;
  if (valores && valores.valor_total != null && totalPago >= Number(valores.valor_total)) {
    await supabase
      .from("pagamentos")
      .update({ status: "pago", valor_pago: totalPago, data_realizado: dataRealizado })
      .eq("desligamento_id", desligamentoId);
    await supabase.from("desligamentos").update({ status: "pago" }).eq("id", desligamentoId);
    concluido = true;
  }

  await notificarPagamentoRegistrado({
    colaboradorNome: await nomeColaboradorPorDesligamento(supabase, desligamentoId),
    valor,
    concluido,
    desligamentoId,
  });

  revalidatePath(`/financeiro/${desligamentoId}`);
  revalidatePath("/financeiro");
  revalidatePath(`/rh/${desligamentoId}`);
  revalidatePath("/rh");

  return { ok: true as const, message: "Parcela registrada com sucesso." };
}