"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

export async function criarUsuarioAction(formData: FormData) {
  await requireRole(["admin"]);
  const admin = createAdminClient();

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "") as UserRole;

  if (!nome || !email || !role) throw new Error("Preencha nome, e-mail e perfil.");

  // Convite por e-mail: o usuário recebe um link para definir a própria senha.
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login`,
  });

  if (error || !data.user) throw new Error(error?.message ?? "Falha ao convidar usuário.");

  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: data.user.id, nome, role });

  if (profileError) throw new Error(profileError.message);

  revalidatePath("/admin/usuarios");
}

export async function atualizarPapelAction(formData: FormData) {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const userId = String(formData.get("user_id"));
  const role = String(formData.get("role")) as UserRole;

  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/usuarios");
}

export async function alternarAtivoAction(formData: FormData) {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const userId = String(formData.get("user_id"));
  const ativo = formData.get("ativo") === "true";

  const { error } = await supabase.from("profiles").update({ ativo: !ativo }).eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/usuarios");
}
