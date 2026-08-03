-- =============================================================================
-- Corrige o cálculo de valor_total: o proporcional deve ser
-- salário ÷ dias_uteis_mes × dias_trabalhados, e não salário ÷ 30 × dias
-- trabalhados como estava (fórmula antiga, de antes de dias_uteis_mes existir).
--
-- Retrocompatibilidade: casos antigos que já têm dias_trabalhados preenchido
-- mas não têm dias_uteis_mes (preenchidos antes desta funcionalidade existir)
-- continuam usando 30 como divisor via coalesce — senão o valor_total desses
-- casos viraria null (dividir por null) e sumiria da tela, o que quebraria o
-- que já estava calculado e fechado. Para qualquer caso novo, dias_uteis_mes
-- e dias_trabalhados são sempre preenchidos juntos pelo Gestor, então o
-- coalesce não entra em ação.
-- =============================================================================

alter table valores_financeiros drop column valor_total;

alter table valores_financeiros add column valor_total numeric(12,2) generated always as (
  round((salario_base * dias_trabalhados / coalesce(dias_uteis_mes, 30)::numeric)::numeric, 2)
  + case when multa_responsavel = 'colaborador' then -valor_multa else valor_multa end
  + valor_acordo
) stored;