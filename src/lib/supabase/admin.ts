import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// ATENÇÃO: este cliente ignora RLS. Nunca importar em código que roda no
// navegador nem em rotas que não tenham validado explicitamente uma
// autorização antes (ex.: o token único do advogado em /distrato/[token]).
// A service role key nunca deve receber o prefixo NEXT_PUBLIC_.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
