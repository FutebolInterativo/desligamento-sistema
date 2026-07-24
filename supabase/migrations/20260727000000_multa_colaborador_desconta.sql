-- =============================================================================
-- Corrige o cálculo do valor total: quando o COLABORADOR é quem paga a multa,
-- esse valor precisa ser DESCONTADO do que ele vai receber — não somado.
-- Quando é a empresa (FI) quem paga, continua somando normalmente (é um
-- valor a mais que ele recebe).
--
-- Postgres não permite que uma coluna gerada (`generated always as`) olhe
-- para outra tabela (o responsável pela multa vive em `acordos`), então
-- replicamos esse campo aqui em `valores_financeiros` — preenchido junto
-- pelo mesmo formulário do gestor — e recriamos a coluna gerada usando-o.
-- =============================================================================

-- 1. Replica o responsável pela multa nesta tabela
alter table valores_financeiros add column if not exists multa_responsavel responsavel_multa;

-- 2. Backfill: copia o que já está registrado em `acordos` pros casos existentes
update valores_financeiros vf
set multa_responsavel = a.multa_responsavel
from acordos a
where a.desligamento_id = vf.desligamento_id
  and vf.multa_responsavel is null;

-- 3. Recria a coluna gerada com o sinal correto pra multa do colaborador.
-- Postgres não permite alterar a expressão de uma generated column — precisa
-- dropar e recriar.
alter table valores_financeiros drop column valor_total;

alter table valores_financeiros add column valor_total numeric(12,2) generated always as (
  round((salario_base * dias_trabalhados / 30.0)::numeric, 2)
  + case when multa_responsavel = 'colaborador' then -valor_multa else valor_multa end
  + valor_acordo
) stored;
