# Arquitetura — Sistema de Gestão de Desligamento (Distrato)

**Stack:** Next.js (App Router) + Supabase (Auth, Postgres, Storage, RLS, Edge Functions)
**Perfis com login:** RH, Gestor, Financeiro, Admin
**Acesso externo sem login:** Advogado (link único por token, enviado por e-mail)
**Assinatura do distrato:** upload manual do PDF assinado (sem integração de e-signature nesta fase)

---

## 1. Visão geral do fluxo como máquina de estados

Cada desligamento é um registro único que caminha por estados. Isso é o coração do sistema: todo o resto (telas, permissões, notificações) gira em torno de "em que estado está este desligamento e quem precisa agir agora".

```
1. conversa_registrada        (Gestor registra a conversa/acordo)
2. enviado_rh                 (RH recebeu o relatório)
3. dados_financeiros_pendentes (Financeiro precisa informar salário/dias/valor)
4. solicitado_advogado        (RH encaminhou pedido de distrato)
5. aguardando_distrato        (prazo de até 2 dias)
6. em_conferencia_rh          (RH recebeu e está revisando)
7. disponivel_assinatura      (documento liberado para assinar)
8. assinado                   (upload do PDF assinado por todas as partes)
9. procedimentos_em_andamento (materiais, acessos, benefícios)
10. aguardando_pagamento      (gate: distrato assinado + NF quando aplicável)
11. pago                      (concluído)

+ cancelado (estado de exceção, disponível em qualquer ponto)
```

Transições são sempre unidirecionais para frente, exceto `em_conferencia_rh → solicitado_advogado` (RH pode devolver o distrato ao advogado se algo estiver errado — feedback loop necessário).

---

## 2. Perfis e o que cada um pode fazer

| Perfil | Cria | Vê | Ação principal |
|---|---|---|---|
| **Gestor** | Registro da conversa de desligamento | Apenas desligamentos dos seus próprios colaboradores | Registra o que foi acordado (multa/acordo/condições) |
| **RH** | — | Todos os desligamentos | Orquestra o processo: recebe, solicita ao advogado, confere distrato, aciona procedimentos, libera pagamento |
| **Financeiro** | Valores (salário × dias trabalhados) | Desligamentos a partir da etapa de valores até o pagamento | Informa valores, confirma NF, registra pagamento |
| **Admin** | Perfis de usuário (`profiles`) | Todos os desligamentos (visão geral, sem participar do fluxo operacional) | Cria/desativa usuários, atribui/altera papéis (`role`), acompanha indicadores gerais do sistema |

O Admin é um perfil **de gestão do sistema**, não um participante do fluxo — ele não registra conversas, não confere distratos, não lança valores. As duas responsabilidades dele são:

1. **Gerenciar perfis:** criar acesso para novos usuários (RH, Gestor, Financeiro), desativar quem saiu, corrigir um papel atribuído errado.
2. **Visão geral:** dashboard consolidado de todos os desligamentos (quantos em cada status, prazos vencidos, tempo médio por etapa) — leitura ampla, mas sem necessidade de editar dados operacionais (isso continua sendo função de cada perfil especializado).

### O advogado é um caso especial: sem login

O advogado é **externo** à empresa, então ele não entra no esquema de `profiles`/Supabase Auth como os demais. O fluxo dele é:

1. RH solicita o distrato → sistema gera um **link único** (token) para aquele desligamento específico.
2. O advogado recebe um **e-mail** com as informações necessárias e esse link.
3. Ele acessa uma página pública (sem senha), vê os dados do desligamento vinculados àquele token, e anexa o distrato.
4. O token é de uso único e passa a expirado depois do upload (ou após o prazo estimado, o que vier primeiro).

Isso é tratado como acesso público autenticado por *capability URL* (o token faz o papel da senha), não como um perfil de usuário do sistema.

Isso mapeia direto para **Row Level Security (RLS)** no Supabase — nada de controle de acesso na aplicação, tudo garantido no banco.

---

## 3. Modelo de dados (Supabase / Postgres)

```sql
-- Perfis de usuário (vincula auth.users a um papel)
create type user_role as enum ('rh', 'gestor', 'financeiro', 'admin');

create table profiles (
  id uuid primary key references auth.users(id),
  nome text not null,
  role user_role not null,
  ativo boolean default true,
  created_at timestamptz default now()
);

-- Colaboradores (pode integrar depois com sistema de RH existente)
create table colaboradores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cargo text,
  data_admissao date,
  gestor_id uuid references profiles(id),
  ativo boolean default true
);

create type status_desligamento as enum (
  'conversa_registrada', 'enviado_rh', 'dados_financeiros_pendentes',
  'solicitado_advogado', 'aguardando_distrato', 'em_conferencia_rh',
  'disponivel_assinatura', 'assinado', 'procedimentos_em_andamento',
  'aguardando_pagamento', 'pago', 'cancelado'
);

-- Registro central do processo
create table desligamentos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid references colaboradores(id) not null,
  gestor_id uuid references profiles(id) not null,
  status status_desligamento not null default 'conversa_registrada',
  motivo text,                    -- opcional
  data_conversa date not null,
  data_ultimo_dia_trabalhado date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- O que foi acordado entre gestor e colaborador
create table acordos (
  id uuid primary key default gen_random_uuid(),
  desligamento_id uuid references desligamentos(id) not null,
  tem_multa boolean default false,
  tem_acordo boolean default false,
  condicoes text,                 -- descrição livre do que foi acordado
  registrado_por uuid references profiles(id),
  created_at timestamptz default now()
);

-- Valores calculados pelo financeiro
create table valores_financeiros (
  id uuid primary key default gen_random_uuid(),
  desligamento_id uuid references desligamentos(id) not null,
  salario_base numeric(12,2) not null,
  dias_trabalhados int not null,
  valor_multa numeric(12,2) default 0,
  valor_acordo numeric(12,2) default 0,
  valor_total numeric(12,2) generated always as
    (salario_base * dias_trabalhados / 30.0 + valor_multa + valor_acordo) stored,
  observacoes text,
  informado_por uuid references profiles(id),
  created_at timestamptz default now()
);

-- Pedido formal ao advogado (externo, sem login — acesso via token único)
create table solicitacoes_advogado (
  id uuid primary key default gen_random_uuid(),
  desligamento_id uuid references desligamentos(id) not null,
  advogado_nome text not null,
  advogado_email text not null,
  token uuid not null default gen_random_uuid() unique,  -- vai na URL do link enviado por e-mail
  dados_enviados jsonb,             -- snapshot dos dados no momento do envio (o que o advogado vê na página pública)
  solicitado_em timestamptz default now(),
  prazo_limite date,                -- solicitado_em + 2 dias
  usado_em timestamptz,             -- preenchido quando o distrato é anexado; token vira inválido depois disso
  observacoes text
);

-- Documentos (minuta, distrato assinado, NF)
create type tipo_documento as enum ('minuta_distrato', 'distrato_assinado', 'nota_fiscal');
create type status_documento as enum ('pendente', 'em_conferencia', 'aprovado', 'rejeitado');

create table documentos (
  id uuid primary key default gen_random_uuid(),
  desligamento_id uuid references desligamentos(id) not null,
  tipo tipo_documento not null,
  arquivo_path text not null,      -- caminho no Supabase Storage
  status status_documento default 'pendente',
  observacoes_conferencia text,
  uploaded_by uuid references profiles(id),        -- null quando for upload externo
  uploaded_by_externo text,                          -- e-mail do advogado, quando aplicável
  uploaded_at timestamptz default now()
);

-- Checklist de procedimentos administrativos
create table procedimentos (
  id uuid primary key default gen_random_uuid(),
  desligamento_id uuid references desligamentos(id) not null unique,
  materiais_recolhidos boolean default false,
  acessos_bloqueados boolean default false,
  beneficios_cancelados boolean default false,
  concluido_por uuid references profiles(id),
  concluido_em timestamptz
);

-- Pagamento
create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  desligamento_id uuid references desligamentos(id) not null unique,
  nf_necessaria boolean default false,
  nf_emitida boolean default false,
  nf_numero text,
  data_prevista date,               -- 5º dia útil do próximo ciclo de folha
  data_realizado date,
  valor_pago numeric(12,2),
  status text default 'pendente'
);

-- Auditoria: toda transição de status fica registrada
create table historico_status (
  id uuid primary key default gen_random_uuid(),
  desligamento_id uuid references desligamentos(id) not null,
  status_anterior status_desligamento,
  status_novo status_desligamento not null,
  alterado_por uuid references profiles(id),
  observacao text,
  alterado_em timestamptz default now()
);
```

**Bucket de Storage:** `distratos/{desligamento_id}/` — políticas de storage seguem a mesma lógica de RLS das tabelas.

---

## 4. RLS — regras de acesso (resumo, não SQL completo)

- `desligamentos`: Gestor vê apenas onde `gestor_id = auth.uid()`. RH e admin veem tudo. Financeiro vê apenas onde `status` ∈ (`dados_financeiros_pendentes`, ..., `pago`). Advogado não acessa esta tabela via RLS — ver seção abaixo sobre acesso por token.
- `documentos` / `storage.objects`: mesma regra herdada do `desligamento_id`.
- Toda escrita fora do próprio papel é bloqueada — ex.: Gestor não pode alterar `valores_financeiros`.
- `profiles`: **somente Admin** pode fazer `insert`/`update` de `role` e `ativo`. Qualquer usuário pode `select` o próprio registro (para saber seu papel), mas não editar. Admin tem `select` amplo em `profiles` para a tela de gerenciamento de usuários.
- Admin tem `select` amplo em `desligamentos`, `acordos`, `valores_financeiros`, `documentos`, `procedimentos`, `pagamentos` e `historico_status` (visão geral), mas **sem `insert`/`update`** nessas tabelas — ele não deve operar o fluxo, só observá-lo e auditar.

### Acesso do advogado (sem RLS — via token)

O advogado não tem `auth.uid()`, então RLS comum não se aplica a ele. O acesso é feito assim:

1. A página pública `/distrato/[token]` **não usa a chave anon do Supabase direto no navegador** para essas tabelas — ela passa por uma **Server Action / Route Handler** no Next.js.
2. O servidor recebe o token, valida contra `solicitacoes_advogado.token` (existe e `usado_em` ainda é null — sem expiração por tempo, só invalida após o upload).
3. Só depois de validado, o servidor usa a **service role key** (never exposta ao cliente) para: (a) buscar `dados_enviados` e mostrar na página, (b) receber o upload e gravar em `documentos` e Storage, (c) marcar `usado_em = now()`.
4. Isso mantém `solicitacoes_advogado` e `documentos` fechadas por RLS para qualquer acesso direto via anon key — o único caminho de escrita externo é esse endpoint controlado, com suas próprias validações (token válido, upload único, tipo de arquivo).

Essa página é a única rota do sistema sem tela de login.

---

## 5. Gate de pagamento (regra de negócio crítica)

O pagamento só pode ser marcado como liberado quando, via trigger ou validação na Server Action:

```
distrato assinado == true
AND (nf_necessaria == false OR nf_emitida == true)
```

Recomendo isso como uma **trigger no Postgres** (não só validação no front), porque é a regra que não pode ser furada.

---

## 6. Telas por perfil (mínimo viável)

**Gestor**
- Lista dos meus colaboradores → "Registrar desligamento" (formulário: data da conversa, motivo opcional, condições, multa/acordo)

**RH** (dashboard central)
- Kanban ou lista por status de todos os desligamentos
- Detalhe do desligamento: timeline de status, botão "Solicitar ao advogado" (monta pacote de dados), tela de conferência do distrato recebido (aprovar/rejeitar), checklist de procedimentos, liberação de pagamento

**Página pública do advogado (sem login)**
- Acessada via `/distrato/[token]` a partir do link recebido por e-mail
- Mostra os dados do desligamento relevantes para a elaboração do documento (dados enviados pelo RH)
- Formulário simples: upload do PDF do distrato
- Após o envio: página de confirmação, token invalidado, status do desligamento avança para `em_conferencia_rh`

**Financeiro**
- Lista de desligamentos aguardando valores
- Formulário: salário base, dias trabalhados → valor calculado automaticamente
- Confirmação de NF emitida
- Registro de pagamento realizado

**Admin**
- Gerenciamento de usuários: lista de `profiles`, criar novo acesso (convite por e-mail via Supabase Auth), editar `role`, ativar/desativar
- Dashboard geral (somente leitura): total de desligamentos por status, prazos vencidos (advogado, pagamento), tempo médio de cada etapa

---

## 7. Automações (Supabase Edge Functions / cron)

- **Envio do e-mail ao advogado:** trigger na criação de `solicitacoes_advogado` chama uma Edge Function que gera o token, monta o link (`/distrato/{token}`) e dispara o e-mail via um serviço de e-mail transacional (Supabase não envia e-mails arbitrários — só os de Auth). Recomendo **Resend** (tem integração simples com Edge Functions/Next.js) ou similar (SendGrid, Postmark).
- **Alerta de prazo do advogado:** job diário verifica `solicitacoes_advogado.prazo_limite` vencido sem documento (`usado_em is null`) e notifica RH.
- **Alerta do 5º dia útil:** job verifica desligamentos em `aguardando_pagamento` próximos da data da folha.
- **Notificações internas:** tabela simples `notificacoes` (destinatario, mensagem, lida) alimentada por triggers a cada troca de status relevante ao próximo responsável.

---

## 8. Stack técnica sugerida

- **Next.js App Router** com Server Actions para mutações (evita expor lógica de negócio em API routes públicas)
- **Supabase Auth** (email/senha ou SSO da empresa, se houver)
- **Supabase Storage** para os PDFs (distrato assinado, NF)
- **Supabase Postgres + RLS** como fonte única de verdade de permissões
- **Edge Functions** para os jobs de prazo/notificação e para disparar o e-mail ao advogado
- **Serviço de e-mail transacional** (Resend, SendGrid ou Postmark) para o envio do link único ao advogado — fora do escopo do Supabase Auth
- Biblioteca de UI: shadcn/ui (Tailwind) — dá um kanban/tabela decente sem esforço de design

---

## 9. Roadmap de implementação sugerido

1. **Fase 1 — Núcleo:** tabelas + RLS + Auth + tela de Admin para gerenciar perfis (precisa existir primeiro para dar acesso aos outros) + telas de Gestor e RH (registrar conversa → enviar → solicitar advogado)
2. **Fase 2 — Advogado (externo) e Financeiro:** geração de token + página pública `/distrato/[token]` + envio de e-mail, telas do Financeiro, cálculo de valores
3. **Fase 3 — Assinatura e procedimentos:** upload do distrato assinado, checklist de procedimentos administrativos
4. **Fase 4 — Pagamento e automações:** gate de pagamento, jobs de prazo, notificações
5. **Fase 5 — Refinos:** dashboard/relatórios para RH, auditoria completa via `historico_status`

---

## Pontos que vale confirmar antes de codar

- O cálculo de "salário sobre os dias trabalhados" no financeiro é só isso, ou entram outras verbas (férias proporcionais, 13º, aviso prévio)? Isso muda o modelo de `valores_financeiros`.
- Existe hoje uma base de colaboradores/gestores em outro sistema (ex: um RH já usado) que precisa ser integrada, ou os dados de `colaboradores` nascem neste sistema?
- "5º dia útil junto com a folha" — a folha já é processada em algum sistema externo? Se sim, o pagamento aqui é só um *registro de status*, não uma execução real de pagamento.
