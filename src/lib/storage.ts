import { createAdminClient } from "@/lib/supabase/admin";

// Gera uma URL temporária para visualizar um arquivo do bucket privado
// "distratos". Só deve ser chamado depois de uma verificação de role
// (requireRole) — esta função em si ignora RLS, igual ao admin client.
export async function getSignedUrl(path: string, expiresInSeconds = 3600) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("distratos")
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) return null;
  return data.signedUrl;
}