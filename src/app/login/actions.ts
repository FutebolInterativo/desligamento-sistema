"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME } from "@/lib/auth";
import type { Profile } from "@/lib/types";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?erro=credenciais");
  }

  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user!.id)
    .single();

  if (!profile || !(profile as Profile).ativo) {
    await supabase.auth.signOut();
    redirect("/login?erro=inativo");
  }

  redirect(ROLE_HOME[(profile as Profile).role]);
}
