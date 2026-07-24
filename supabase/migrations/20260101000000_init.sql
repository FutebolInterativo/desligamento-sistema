-- =============================================================================
-- Sistema de Gestão de Desligamento (Distrato) — schema Supabase/Postgres
-- Migration inicial. Aplicada via `npm run db:push` (Supabase CLI) ou,
-- manualmente, colando este conteúdo no SQL Editor do projeto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Extensões
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------------
create type user_role as enum ('rh', 'gestor', 'financeiro', 'admin');

create type status_desligamento as enum (
  'conversa_registrada', 'enviado_rh', 'dados_financeiros_pendentes',
  'solicitado_advogado', 'aguardando_distrato', 'em_conferencia_rh',
  'disponivel_assinatura', 'assinado', 'procedimentos_em_andamento',
  'aguardando_pagamento', 'pago', 'cancelado'
);

create type tipo_documento as enum ('minuta_distrato', 'distrato_assinado', 'nota_fiscal');
create type status_documento as enum ('pendente', 'em_conferencia', 'aprovado', 'rejeitado');
create type status_pagamento as enum ('pendente', 'liberado', 'pago');

-- -----------------------------------------------------------------------------
-- 2. Tabelas
-- -----------------------------------------------------------------------------

-- Perfis de usuário interno (RH, Gestor, Financeiro, Admin). O advogado NÃO
-- tem linha aqui — ele é externo e acessa via token (ver solicitacoes_advogado).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  role user_role not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table colaboradores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cargo text,
  data_admissao date,
  gestor_id uuid not null references profiles(id),
  ativo boolean not null default true
);

create table desligamentos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores(id),
  gestor_id uuid not null references profiles(id),
  status status_desligamento not null default 'conversa_registrada',
  motivo text,
  data_conversa date not null,
  data_ultimo_dia_trabalhado date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table acordos (
  id uuid primary key default gen_random_uuid(),
  desligamento_id uuid not null references desligamentos(id) on delete cascade,
  tem_multa boolean not null default false,
  tem_acordo boolean not null default false,
  condicoes text,
  registrado_por uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table valores_financeiros (
  id uuid primary key default gen_random_uuid(),
  desligamento_id uuid not null references desligamentos(id) on delete cascade,
  salario_base numeric(12,2) not null,
  dias_trabalhados int not null,
  valor_multa numeric(12,2) not null default 0,
  valor_acordo numeric(12,2) not null default 0,
  valor_total numeric(12,2) generated always as
    (round((salario_base * dias_trabalhados / 30.0)::numeric, 2) + valor_multa + valor_acordo) stored,
  observacoes text,
  informado_por uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Advogado é externo: sem profile, sem login. O acesso ao upload é feito
-- por um token único enviado por e-mail (sem expiração por tempo — só
-- invalida depois de usado, ver `usado_em`).
create table solicitacoes_advogado (
  id uuid primary key default gen_random_uuid(),
  desligamento_id uuid not null references desligamentos(id) on delete cascade,
  advogado_nome text not null,
  advogado_email text not null,
  token uuid not null unique default gen_random_uuid(),
  dados_enviados jsonb,
  solicitado_em timestamptz not null default now(),
  prazo_limite date,
  usado_em timestamptz,
  observacoes text
);

create table documentos (
  id uuid primary key default gen_random_uuid(),
  desligamento_id uuid not null references desligamentos(id) on delete cascade,
  tipo tipo_documento not null,
  arquivo_path text not null,
  status status_documento not null default 'pendente',
  observacoes_conferencia text,
  uploaded_by uuid references profiles(id),
  uploaded_by_externo text,
  uploaded_at timestamptz not null default now()
);

create table procedimentos (
  id uuid primary key default gen_random_uuid(),
  desligamento_id uuid not null unique references desligamentos(id) on delete cascade,
  materiais_recolhidos boolean not null default false,
  acessos_bloqueados boolean not null default false,
  beneficios_cancelados boolean not null default false,
  concluido_por uuid references profiles(id),
  concluido_em timestamptz
);

create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  desligamento_id uuid not null unique references desligamentos(id) on delete cascade,
  nf_necessaria boolean not null default false,
  nf_emitida boolean not null default false,
  nf_numero text,
  data_prevista date,
  data_realizado date,
  valor_pago numeric(12,2),
  status status_pagamento not null default 'pendente'
);

create table historico_status (
  id uuid primary key default gen_random_uuid(),
  desligamento_id uuid not null references desligamentos(id) on delete cascade,
  status_anterior status_desligamento,
  status_novo status_desligamento not null,
  alterado_por uuid references profiles(id),
  observacao text,
  alterado_em timestamptz not null default now()
);

create table notificacoes (
  id uuid primary key default gen_random_uuid(),
  desligamento_id uuid references desligamentos(id) on delete cascade,
  destinatario_id uuid not null references profiles(id),
  mensagem text not null,
  lida boolean not null default false,
  criada_em timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3. Funções e triggers
-- -----------------------------------------------------------------------------

-- role do usuário logado, usada nas policies de RLS
create or replace function auth_role()
returns user_role
language sql stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- updated_at automático em desligamentos
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_desligamentos_updated_at
before update on desligamentos
for each row execute function set_updated_at();

-- registra toda troca de status em historico_status
create or replace function log_status_change()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') or (old.status is distinct from new.status) then
    insert into historico_status (desligamento_id, status_anterior, status_novo, alterado_por)
    values (new.id, case when tg_op = 'INSERT' then null else old.status end, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_log_status_change
after insert or update on desligamentos
for each row execute function log_status_change();

-- Gate de pagamento: só permite marcar pagamentos.status como 'liberado' ou
-- 'pago' se o distrato estiver assinado (documento aprovado) e, quando
-- necessária, a NF estiver emitida. É a regra que não pode ser furada —
-- por isso vive no banco, não só na tela.
create or replace function check_gate_pagamento()
returns trigger language plpgsql as $$
declare
  distrato_ok boolean;
begin
  if new.status in ('liberado', 'pago') then
    select exists (
      select 1 from documentos
      where desligamento_id = new.desligamento_id
        and tipo = 'distrato_assinado'
        and status = 'aprovado'
    ) into distrato_ok;

    if not distrato_ok then
      raise exception 'Pagamento bloqueado: distrato ainda não está assinado e aprovado.';
    end if;

    if new.nf_necessaria and not new.nf_emitida then
      raise exception 'Pagamento bloqueado: nota fiscal ainda não foi emitida.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_check_gate_pagamento
before insert or update on pagamentos
for each row execute function check_gate_pagamento();

-- -----------------------------------------------------------------------------
-- 4. RLS
-- -----------------------------------------------------------------------------
alter table profiles enable row level security;
alter table colaboradores enable row level security;
alter table desligamentos enable row level security;
alter table acordos enable row level security;
alter table valores_financeiros enable row level security;
alter table solicitacoes_advogado enable row level security;
alter table documentos enable row level security;
alter table procedimentos enable row level security;
alter table pagamentos enable row level security;
alter table historico_status enable row level security;
alter table notificacoes enable row level security;

-- profiles: qualquer usuário lê o próprio registro; admin lê e edita todos
create policy "profiles_select_self" on profiles for select using (id = auth.uid());
create policy "profiles_select_admin" on profiles for select using (auth_role() = 'admin');
create policy "profiles_write_admin" on profiles for all using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- colaboradores: gestor vê os seus, RH/admin veem todos
create policy "colaboradores_select" on colaboradores for select using (
  gestor_id = auth.uid() or auth_role() in ('rh', 'admin')
);
create policy "colaboradores_write_rh" on colaboradores for all using (
  auth_role() in ('rh', 'admin')
) with check (auth_role() in ('rh', 'admin'));

-- desligamentos: gestor só os seus; RH/admin todos; financeiro só a partir
-- da etapa de valores em diante
create policy "desligamentos_select" on desligamentos for select using (
  gestor_id = auth.uid()
  or auth_role() in ('rh', 'admin')
  or (auth_role() = 'financeiro' and status <> 'conversa_registrada')
);
create policy "desligamentos_insert_gestor" on desligamentos for insert with check (
  gestor_id = auth.uid() or auth_role() in ('rh', 'admin')
);
create policy "desligamentos_update_rh" on desligamentos for update using (
  auth_role() in ('rh', 'admin')
);

-- acordos: quem registrou (gestor) ou RH/admin
create policy "acordos_select" on acordos for select using (
  exists (select 1 from desligamentos d where d.id = desligamento_id and (
    d.gestor_id = auth.uid() or auth_role() in ('rh', 'admin')
  ))
);
create policy "acordos_write_gestor" on acordos for insert with check (
  exists (select 1 from desligamentos d where d.id = desligamento_id and d.gestor_id = auth.uid())
  or auth_role() in ('rh', 'admin')
);
create policy "acordos_update_rh" on acordos for update using (auth_role() in ('rh', 'admin'));

-- valores_financeiros: financeiro escreve; RH/admin/gestor (do caso) leem
create policy "valores_select" on valores_financeiros for select using (
  auth_role() in ('rh', 'admin', 'financeiro')
  or exists (select 1 from desligamentos d where d.id = desligamento_id and d.gestor_id = auth.uid())
);
create policy "valores_write_financeiro" on valores_financeiros for all using (
  auth_role() in ('financeiro', 'rh', 'admin')
) with check (auth_role() in ('financeiro', 'rh', 'admin'));

-- solicitacoes_advogado: só RH/admin (o advogado acessa via rota com
-- service role, nunca pela anon key — ver seção 5)
create policy "solicitacoes_advogado_all_rh" on solicitacoes_advogado for all using (
  auth_role() in ('rh', 'admin')
) with check (auth_role() in ('rh', 'admin'));

-- documentos: RH/admin tudo; gestor e financeiro só leem os do seu contexto
create policy "documentos_select" on documentos for select using (
  auth_role() in ('rh', 'admin', 'financeiro')
  or exists (select 1 from desligamentos d where d.id = desligamento_id and d.gestor_id = auth.uid())
);
create policy "documentos_write_rh" on documentos for all using (
  auth_role() in ('rh', 'admin')
) with check (auth_role() in ('rh', 'admin'));

-- procedimentos: RH/admin
create policy "procedimentos_all_rh" on procedimentos for all using (
  auth_role() in ('rh', 'admin')
) with check (auth_role() in ('rh', 'admin'));

-- pagamentos: financeiro escreve; RH/admin leem e liberam
create policy "pagamentos_select" on pagamentos for select using (
  auth_role() in ('rh', 'admin', 'financeiro')
);
create policy "pagamentos_write" on pagamentos for all using (
  auth_role() in ('financeiro', 'rh', 'admin')
) with check (auth_role() in ('financeiro', 'rh', 'admin'));

-- historico_status: leitura ampla para quem já vê o desligamento
create policy "historico_select" on historico_status for select using (
  auth_role() in ('rh', 'admin', 'financeiro')
  or exists (select 1 from desligamentos d where d.id = desligamento_id and d.gestor_id = auth.uid())
);

-- notificacoes: cada um vê e marca como lida as próprias
create policy "notificacoes_select_self" on notificacoes for select using (destinatario_id = auth.uid());
create policy "notificacoes_update_self" on notificacoes for update using (destinatario_id = auth.uid());
create policy "notificacoes_insert_system" on notificacoes for insert with check (auth_role() in ('rh', 'admin'));

-- -----------------------------------------------------------------------------
-- 5. Storage
-- -----------------------------------------------------------------------------
-- Criar manualmente no dashboard (Storage → New bucket): nome "distratos",
-- privado (não público). O upload feito pelo advogado externo passa pela
-- rota /distrato/[token], que usa a service role key no servidor — por
-- isso não é necessário (nem desejável) abrir policy de storage para anon.
--
-- Policies sugeridas para o bucket "distratos" (usuários internos lendo):
--   select: auth_role() in ('rh','admin') via policy customizada em storage.objects
-- (ajustar pelo dashboard, pois a sintaxe de storage.objects usa bucket_id).

-- -----------------------------------------------------------------------------
-- 6. Bootstrap do primeiro Admin
-- -----------------------------------------------------------------------------
-- 1. Crie o usuário em Authentication → Users → Add user (defina e-mail/senha).
-- 2. Copie o UUID gerado e rode:
--    insert into profiles (id, nome, role) values ('<uuid-do-usuario>', 'Seu Nome', 'admin');
-- A partir daí, o próprio Admin cria os demais acessos pela tela /admin/usuarios.
