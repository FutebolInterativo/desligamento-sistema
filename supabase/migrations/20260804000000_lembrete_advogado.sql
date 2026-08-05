-- =============================================================================
-- Permite ao RH reenviar o e-mail da solicitação original ao advogado
-- (mesmo token/link, mesmos dados já salvos) — útil tanto como lembrete
-- quanto para reenviar com um link corrigido caso o domínio do app tenha
-- mudado depois do envio original.
-- =============================================================================

alter table solicitacoes_advogado
  add column if not exists lembrete_enviado_em timestamptz;

comment on column solicitacoes_advogado.lembrete_enviado_em is
  'Data/hora do último reenvio manual do e-mail de solicitação, feito pelo RH.';
