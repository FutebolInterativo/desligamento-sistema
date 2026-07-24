# Sistema de Gestão de Desligamento (Distrato)

Next.js (App Router) + Supabase. Implementa o fluxo completo: conversa de
desligamento → RH → valores (financeiro) → solicitação ao advogado externo
(link único, sem login) → conferência → assinatura (upload manual do PDF) →
procedimentos administrativos → pagamento no 5º dia útil.

## 1. Criar o projeto no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Aplique o schema — duas formas possíveis:
   - **Via CLI (recomendado, `npm run db:push`):**
     ```bash
     npx supabase login
     npm run db:link -- --project-ref xxxxx   # "xxxxx" está na URL do projeto no dashboard
     npm run db:push
     ```
     Isso aplica `supabase/migrations/20260101000000_init.sql` no banco remoto.
     Futuras alterações de schema: crie uma nova migration com
     `npx supabase migration new nome_da_mudanca`, edite o SQL gerado em
     `supabase/migrations/`, e rode `npm run db:push` de novo.
   - **Via SQL Editor (manual):** abra o painel do projeto → **SQL Editor** →
     cole o conteúdo de `supabase/migrations/20260101000000_init.sql` → Run.
3. Vá em **Storage** → *New bucket* → crie um bucket chamado `distratos`,
   marcado como **privado** (não público). Isso não faz parte do schema SQL,
   precisa ser feito pela interface (ou pela Management API, se preferir
   automatizar depois).

## 2. Variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha:


- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`: em Project
  Settings → API.
- `SUPABASE_SERVICE_ROLE_KEY`: mesma tela — **nunca** exponha essa chave no
  navegador ou em código com prefixo `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_APP_URL`: URL onde a aplicação vai rodar (ex.: seu domínio na
  Vercel). É usada para montar o link enviado ao advogado.
- `RESEND_API_KEY` e `EMAIL_FROM`: crie uma conta em
  [resend.com](https://resend.com) para o envio do e-mail ao advogado. Sem
  essa chave, o sistema funciona normalmente, mas o e-mail só é logado no
  console em vez de enviado — útil em desenvolvimento local.

## 3. Criar o primeiro usuário Admin

O sistema não tem cadastro público — todo acesso é criado por um Admin. Para
o primeiro:

1. No Supabase, vá em **Authentication → Users → Add user** e crie um
   usuário com e-mail e senha.
2. Copie o UUID gerado e rode no SQL Editor:
   ```sql
   insert into profiles (id, nome, role)
   values ('<uuid-do-usuario>', 'Seu Nome', 'admin');
   ```
3. Faça login em `/login` com esse e-mail/senha. A partir daí, use a tela
   **Usuários** (dentro do painel Admin) para convidar RH, Gestores e
   Financeiro — cada convite chega por e-mail para a pessoa definir a
   própria senha.

O **advogado nunca aparece nessa lista**: ele é externo e recebe, por
e-mail, um link único (`/distrato/[token]`) gerado pelo RH ao solicitar o
distrato. Não expira por tempo, só fica indisponível depois do envio do
documento (e o RH pode reabrir o mesmo link caso precise de revisão).

## 4. Rodar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## 5. Estrutura

```
src/
  app/
    login/                    tela de login
    distrato/[token]/         página pública do advogado (sem login)
    (dashboard)/
      admin/                  painel geral + gerenciar usuários
      gestor/                 registrar desligamento
      rh/                     orquestra todo o fluxo
      financeiro/             valores, NF e pagamento
  components/                 design system (cores do briefing)
  lib/
    supabase/                 clientes (browser, server, admin/service-role)
    status.ts                 máquina de estados do processo
    email.ts                  envio do e-mail ao advogado (Resend)
supabase/
  migrations/
    20260101000000_init.sql   schema completo: tabelas, RLS, triggers
  config.toml                 configuração da Supabase CLI
```

## 6. Regras que vivem no banco, não só na tela

- **Gate de pagamento**: um trigger em `pagamentos` bloqueia marcar o
  pagamento como realizado se o distrato não estiver assinado/aprovado, ou
  se faltar NF em um caso que exige NF. Isso não pode ser furado pela
  interface.
- **RLS por perfil**: Gestor só vê os próprios casos; Financeiro só vê a
  partir da etapa de valores; Admin lê tudo mas não edita o fluxo
  operacional (só perfis de usuário).
- **Acesso do advogado**: nunca passa pela anon key. A página
  `/distrato/[token]` valida o token no servidor e usa a service role key
  só depois de validado.

## Próximos passos sugeridos

- Configurar o envio de e-mail em produção (Resend) e testar o link do
  advogado de ponta a ponta.
- Adicionar um job agendado (Supabase Edge Function + cron) para alertar o
  RH quando um prazo de advogado vencer — o campo `prazo_limite` já existe
  em `solicitacoes_advogado` para isso.
- Ajustar o cálculo de valores no Financeiro caso entrem verbas além de
  salário proporcional (férias, 13º, aviso prévio).
