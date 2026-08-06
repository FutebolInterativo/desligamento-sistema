-- =============================================================================
-- Expande os "Procedimentos administrativos" para espelhar o checklist de
-- onboarding — tudo que é configurado na entrada do colaborador precisa ser
-- desfeito na saída. Os 3 itens genéricos que já existiam
-- (materiais_recolhidos, acessos_bloqueados, beneficios_cancelados) são
-- mantidos no schema (não removidos, para não perder histórico de casos já
-- concluídos), mas a partir desta migration a tela do RH e o gate de
-- conclusão passam a usar os 8 itens novos, mais específicos, no lugar
-- deles. Ficaram de fora "Código de vestimenta" e "Preparar kit de
-- boas-vindas", que só existem no onboarding e não têm uma ação de
-- desfazer no desligamento.
-- =============================================================================

alter table procedimentos
  add column if not exists notebook_recolhido boolean not null default false,
  add column if not exists celular_recolhido boolean not null default false,
  add column if not exists email_desativado boolean not null default false,
  add column if not exists slack_removido boolean not null default false,
  add column if not exists documentos_contrato_arquivados boolean not null default false,
  add column if not exists wellhub_cancelado boolean not null default false,
  add column if not exists grupo_avisos_removido boolean not null default false,
  add column if not exists alice_cancelado boolean not null default false;