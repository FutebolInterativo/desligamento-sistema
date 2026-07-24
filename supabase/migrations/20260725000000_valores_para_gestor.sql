-- =============================================================================
-- Move a responsabilidade pelos valores negociados (salário, multa, acordo)
-- para o Gestor, que já sabe esses números no momento do registro. Só os
-- "dias trabalhados no mês" seguem com o RH, pois só são conhecidos quando o
-- último dia de fato acontece. O Financeiro deixa de editar valores.
-- =============================================================================

-- dias_trabalhados agora é preenchido depois (pelo RH) — não dá mais pra
-- exigir na hora em que o gestor cria o registro.
alter table valores_financeiros alter column dias_trabalhados drop not null;

-- Gestor passa a poder inserir os valores do próprio caso (salário, multa,
-- acordo) já no ato do registro. RH e admin continuam podendo tudo.
create policy "valores_insert_gestor" on valores_financeiros for insert with check (
  exists (select 1 from desligamentos d where d.id = desligamento_id and d.gestor_id = auth.uid())
);
