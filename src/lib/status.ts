import type { StatusDesligamento } from "./types";

// Ordem oficial do pipeline — usada no componente de trilha de status.
// "cancelado" é tratado fora da trilha, como estado de exceção.
export const PIPELINE_ORDER: StatusDesligamento[] = [
  "conversa_registrada",
  "enviado_rh",
  "dados_financeiros_pendentes",
  "solicitado_advogado",
  "aguardando_distrato",
  "em_conferencia_rh",
  "disponivel_assinatura",
  "assinado",
  "procedimentos_em_andamento",
  "aguardando_pagamento",
  "pago",
];

export const STATUS_LABEL: Record<StatusDesligamento, string> = {
  conversa_registrada: "Conversa registrada",
  enviado_rh: "Enviado ao RH",
  dados_financeiros_pendentes: "Valores pendentes",
  solicitado_advogado: "Solicitado ao advogado",
  aguardando_distrato: "Aguardando distrato",
  em_conferencia_rh: "Em conferência (RH)",
  disponivel_assinatura: "Disponível p/ assinatura",
  assinado: "Assinado",
  procedimentos_em_andamento: "Procedimentos em andamento",
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  cancelado: "Cancelado",
};

export const STATUS_SHORT: Record<StatusDesligamento, string> = {
  conversa_registrada: "Conversa",
  enviado_rh: "RH",
  dados_financeiros_pendentes: "Valores",
  solicitado_advogado: "Advogado",
  aguardando_distrato: "Distrato",
  em_conferencia_rh: "Conferência",
  disponivel_assinatura: "Assinatura",
  assinado: "Assinado",
  procedimentos_em_andamento: "Procedimentos",
  aguardando_pagamento: "Pagamento",
  pago: "Pago",
  cancelado: "Cancelado",
};

export function statusIndex(status: StatusDesligamento): number {
  return PIPELINE_ORDER.indexOf(status);
}

export function isCancelado(status: StatusDesligamento): boolean {
  return status === "cancelado";
}
