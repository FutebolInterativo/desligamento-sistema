-- =============================================================================
-- Adiciona: e-mail do colaborador, fluxo de NF pelo colaborador (link único,
-- mesmo padrão do advogado) e leitura ampliada do pipeline para Gestor e
-- Financeiro (sem dar poder de edição sobre partes que não são deles).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. E-mail do colaborador (necessário para o link de NF)
-- -----------------------------------------------------------------------------
alter table colaboradores add column if not exists email text;

-- -----------------------------------------------------------------------------
-- 2. Solicitação de NF ao colaborador — mesmo padrão do advogado: token único,
-- sem expiração por tempo, só invalida depois de usado.
-- -----------------------------------------------------------------------------
create table if not exists solicitacoes_nf (
  id uuid primary key default gen_random_uuid(),
  desligamento_id uuid not null references desligamentos(id) on delete cascade,
  colaborador_email text not null,
  token uuid not null unique default gen_random_uuid(),
  dados_enviados jsonb,
  solicitado_em timestamptz not null default now(),
  usado_em timestamptz,
  observacoes text
);

alter table solicitacoes_nf enable row level security;

create policy "solicitacoes_nf_all_rh_financeiro" on solicitacoes_nf for all using (
  auth_role() in ('rh', 'admin', 'financeiro')
) with check (
  auth_role() in ('rh', 'admin', 'financeiro')
);

-- -----------------------------------------------------------------------------
-- 3. Leitura ampliada: Gestor (só os próprios casos) e Financeiro passam a
-- ver o pipeline completo — acordo, solicitação ao advogado, procedimentos,
-- pagamento — sem ganhar permissão de escrita sobre essas partes.
-- -----------------------------------------------------------------------------

create policy "acordos_select_financeiro" on acordos for select using (
  auth_role() = 'financeiro'
);

create policy "solicitacoes_advogado_select_leitura" on solicitacoes_advogado for select using (
  auth_role() = 'financeiro'
  or exists (
    select 1 from desligamentos d where d.id = desligamento_id and d.gestor_id = auth.uid()
  )
);

create policy "procedimentos_select_leitura" on procedimentos for select using (
  auth_role() = 'financeiro'
  or exists (
    select 1 from desligamentos d where d.id = desligamento_id and d.gestor_id = auth.uid()
  )
);

create policy "pagamentos_select_gestor" on pagamentos for select using (
  exists (
    select 1 from desligamentos d where d.id = desligamento_id and d.gestor_id = auth.uid()
  )
);
