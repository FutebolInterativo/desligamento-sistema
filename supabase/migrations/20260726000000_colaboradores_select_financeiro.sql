-- =============================================================================
-- Corrige: Financeiro não conseguia ver o nome (e demais dados) do colaborador
-- porque a policy de leitura de `colaboradores` nunca incluiu o papel
-- 'financeiro' — só gestor (do próprio caso) e rh/admin. Isso fazia o join
-- `colaborador:colaboradores(*)` voltar vazio pra esse papel, mesmo o
-- Financeiro já podendo ler o `desligamento` em si.
-- =============================================================================

create policy "colaboradores_select_financeiro" on colaboradores for select using (
  auth_role() = 'financeiro'
);
