import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .single();

  return (profile as Profile) ?? null;
}

// Usar no topo de páginas restritas a um ou mais perfis.
export async function requireRole(allowed: UserRole[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.ativo) redirect("/login");
  if (!allowed.includes(profile.role)) redirect("/");
  return profile;
}

export const ROLE_HOME: Record<UserRole, string> = {
  admin: "/admin",
  rh: "/rh",
  gestor: "/gestor",
  financeiro: "/financeiro",
};
