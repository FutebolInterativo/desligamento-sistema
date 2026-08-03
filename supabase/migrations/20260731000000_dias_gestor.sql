-- =============================================================================
-- Move o preenchimento dos "dias trabalhados no mês" do RH para o Gestor, e
-- adiciona um novo campo "dias úteis no mês" (também preenchido pelo Gestor).
--
-- Retrocompatível de propósito:
-- - `dias_trabalhados` já existe e já é nullable (migration 20260725) — não é
--   alterado, só passa a ser preenchido por outro perfil. Desligamentos que já
--   têm esse valor gravado continuam exatamente como estão.
-- - `dias_uteis_mes` é uma coluna nova, nullable, sem valor default: para
--   casos já existentes ela simplesmente fica null (exibido como "—" na
--   tela), sem exigir backfill nem quebrar nenhuma consulta atual.
-- - Não mexe em `valor_total` (coluna gerada) nem no gate de pagamento: ambos
--   continuam calculando a partir de `dias_trabalhados`, que continua
--   existindo com o mesmo nome e tipo.
-- =============================================================================

alter table valores_financeiros
  add column if not exists dias_uteis_mes int;

comment on column valores_financeiros.dias_uteis_mes is
  'Dias úteis no mês do desligamento, informado pelo Gestor junto com dias_trabalhados.';

-- O Gestor já podia INSERIR a linha de valores do próprio caso (migration
-- 20260725), mas não podia fazer UPDATE nela depois — só RH/Financeiro/Admin
-- tinham essa permissão (policy "valores_write_financeiro"). Como agora é o
-- Gestor quem completa dias_trabalhados/dias_uteis_mes depois do registro
-- inicial, ele precisa de uma policy de update, restrita ao próprio caso.
create policy "valores_update_gestor" on valores_financeiros for update using (
  exists (select 1 from desligamentos d where d.id = desligamento_id and d.gestor_id = auth.uid())
) with check (
  exists (select 1 from desligamentos d where d.id = desligamento_id and d.gestor_id = auth.uid())
);