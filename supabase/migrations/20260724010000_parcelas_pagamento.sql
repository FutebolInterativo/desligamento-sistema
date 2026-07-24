-- =============================================================================
-- Permite registrar o pagamento em mais de uma parcela (parcelado), mantendo
-- o mesmo gate de segurança já existente em `pagamentos` (distrato assinado
-- + NF, quando necessária).
-- =============================================================================

create table if not exists parcelas_pagamento (
  id uuid primary key default gen_random_uuid(),
  desligamento_id uuid not null references desligamentos(id) on delete cascade,
  numero_parcela int not null default 1,
  valor numeric(12,2) not null,
  data_prevista date,
  data_realizado date,
  status status_pagamento not null default 'pendente',
  registrado_por uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table parcelas_pagamento enable row level security;

-- mesma leitura ampliada usada em `pagamentos`
create policy "parcelas_pagamento_select" on parcelas_pagamento for select using (
  auth_role() in ('rh', 'admin', 'financeiro')
  or exists (select 1 from desligamentos d where d.id = desligamento_id and d.gestor_id = auth.uid())
);

create policy "parcelas_pagamento_write" on parcelas_pagamento for all using (
  auth_role() in ('financeiro', 'rh', 'admin')
) with check (
  auth_role() in ('financeiro', 'rh', 'admin')
);

-- Gate: mesma regra do `check_gate_pagamento`, mas consultando nf_necessaria/
-- nf_emitida na linha correspondente de `pagamentos` (a parcela em si não
-- carrega esses campos).
create or replace function check_gate_parcela_pagamento()
returns trigger language plpgsql as $$
declare
  distrato_ok boolean;
  pg pagamentos%rowtype;
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

    select * into pg from pagamentos where desligamento_id = new.desligamento_id;
    if found and pg.nf_necessaria and not pg.nf_emitida then
      raise exception 'Pagamento bloqueado: nota fiscal ainda não foi emitida.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_check_gate_parcela_pagamento
before insert or update on parcelas_pagamento
for each row execute function check_gate_parcela_pagamento();
