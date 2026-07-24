import { redirect } from "next/navigation";
import { getCurrentProfile, ROLE_HOME } from "@/lib/auth";

export default async function RootPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.ativo) redirect("/login");
  redirect(ROLE_HOME[profile.role]);
}
