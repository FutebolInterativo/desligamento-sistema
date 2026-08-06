// Tipos que espelham o schema definido em supabase/schema.sql

export type UserRole = "rh" | "gestor" | "financeiro" | "admin";

export type StatusDesligamento =
  | "conversa_registrada"
  | "enviado_rh"
  | "dados_financeiros_pendentes"
  | "solicitado_advogado"
  | "aguardando_distrato"
  | "em_conferencia_rh"
  | "disponivel_assinatura"
  | "assinado"
  | "procedimentos_em_andamento"
  | "aguardando_pagamento"
  | "pago"
  | "cancelado";

export type TipoDocumento = "minuta_distrato" | "distrato_assinado" | "nota_fiscal";
export type StatusDocumento = "pendente" | "em_conferencia" | "aprovado" | "rejeitado";
export type TipoVinculo = "clt" | "pj" | "estagio";
export type ResponsavelMulta = "colaborador" | "empresa";

export interface Profile {
  id: string;
  nome: string;
  role: UserRole;
  ativo: boolean;
  created_at: string;
}

export interface Colaborador {
  id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  cpf: string | null;
  tipo_vinculo: TipoVinculo;
  data_admissao: string | null;
  gestor_id: string;
  ativo: boolean;
}

export interface Desligamento {
  id: string;
  colaborador_id: string;
  gestor_id: string;
  status: StatusDesligamento;
  motivo: string | null;
  data_conversa: string;
  data_ultimo_dia_trabalhado: string | null;
  created_at: string;
  updated_at: string;
  // joins opcionais usados nas telas
  colaborador?: Colaborador;
  acordo?: Acordo;
  valores?: ValoresFinanceiros;
  pagamento?: Pagamento;
  procedimentos?: Procedimentos;
}

export interface Acordo {
  id: string;
  desligamento_id: string;
  tem_multa: boolean;
  multa_responsavel: ResponsavelMulta | null;
  tem_acordo: boolean;
  condicoes: string | null;
  registrado_por: string | null;
  created_at: string;
}

export interface ValoresFinanceiros {
  id: string;
  desligamento_id: string;
  salario_base: number;
  dias_trabalhados: number | null;
  dias_uteis_mes: number | null;
  valor_multa: number;
  valor_acordo: number;
  multa_responsavel: "colaborador" | "empresa" | null;
  valor_total: number | null;
  observacoes: string | null;
  informado_por: string | null;
  created_at: string;
}

export interface SolicitacaoAdvogado {
  id: string;
  desligamento_id: string;
  advogado_nome: string;
  advogado_email: string;
  token: string;
  dados_enviados: Record<string, unknown> | null;
  solicitado_em: string;
  prazo_limite: string | null;
  usado_em: string | null;
  observacoes: string | null;
  distrato_assinado_enviado_em: string | null;
  lembrete_enviado_em: string | null;
}

export interface SolicitacaoNf {
  id: string;
  desligamento_id: string;
  colaborador_email: string;
  token: string;
  dados_enviados: Record<string, unknown> | null;
  solicitado_em: string;
  usado_em: string | null;
  observacoes: string | null;
}

export interface DocumentoRow {
  id: string;
  desligamento_id: string;
  tipo: TipoDocumento;
  arquivo_path: string;
  status: StatusDocumento;
  observacoes_conferencia: string | null;
  uploaded_by: string | null;
  uploaded_by_externo: string | null;
  uploaded_at: string;
}

export interface Procedimentos {
  id: string;
  desligamento_id: string;
  materiais_recolhidos: boolean;
  acessos_bloqueados: boolean;
  beneficios_cancelados: boolean;
  notebook_recolhido: boolean;
  celular_recolhido: boolean;
  email_desativado: boolean;
  slack_removido: boolean;
  documentos_contrato_arquivados: boolean;
  wellhub_cancelado: boolean;
  grupo_avisos_removido: boolean;
  alice_cancelado: boolean;
  concluido_por: string | null;
  concluido_em: string | null;
}

export interface Pagamento {
  id: string;
  desligamento_id: string;
  nf_necessaria: boolean;
  nf_emitida: boolean;
  nf_numero: string | null;
  data_prevista: string | null;
  data_realizado: string | null;
  valor_pago: number | null;
  status: "pendente" | "liberado" | "pago";
}

export interface ParcelaPagamento {
  id: string;
  desligamento_id: string;
  numero_parcela: number;
  valor: number;
  data_prevista: string | null;
  data_realizado: string | null;
  status: "pendente" | "liberado" | "pago";
  registrado_por: string | null;
  created_at: string;
}

export interface HistoricoStatus {
  id: string;
  desligamento_id: string;
  status_anterior: StatusDesligamento | null;
  status_novo: StatusDesligamento;
  alterado_por: string | null;
  observacao: string | null;
  alterado_em: string;
}