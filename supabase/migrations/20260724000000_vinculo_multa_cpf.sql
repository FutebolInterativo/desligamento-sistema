-- =============================================================================
-- Adiciona: tipo de vínculo do colaborador (define emissão de NF), responsável
-- pelo pagamento da multa (colaborador x empresa) e CPF do colaborador
-- (preenchido pelo RH, necessário para o distrato).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tipo de vínculo — define se o colaborador emite nota fiscal (PJ) ou não
-- -----------------------------------------------------------------------------
create type tipo_vinculo as enum ('clt', 'pj', 'estagio');

alter table colaboradores add column if not exists tipo_vinculo tipo_vinculo not null default 'clt';
alter table colaboradores add column if not exists cpf text;

-- -----------------------------------------------------------------------------
-- 2. Responsável pela multa — quem paga quando `tem_multa` é verdadeiro
-- -----------------------------------------------------------------------------
create type responsavel_multa as enum ('colaborador', 'empresa');

alter table acordos add column if not exists multa_responsavel responsavel_multa;

-- -----------------------------------------------------------------------------
-- 3. Marca de envio do distrato assinado ao advogado (PDF)
-- -----------------------------------------------------------------------------
alter table solicitacoes_advogado add column if not exists distrato_assinado_enviado_em timestamptz;
