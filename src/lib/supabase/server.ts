import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente "por usuário": usa a anon key + cookies de sessão.
// Toda leitura/escrita feita com este cliente passa pelas policies de RLS.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // set() chamado a partir de um Server Component — ignorável,
            // o middleware já cuida de refrescar a sessão.
          }
        },
      },
    }
  );
}
