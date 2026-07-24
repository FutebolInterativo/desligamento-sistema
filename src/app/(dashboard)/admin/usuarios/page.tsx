import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { UserPlus } from "lucide-react";
import type { Profile } from "@/lib/types";
import { criarUsuarioAction, atualizarPapelAction, alternarAtivoAction } from "../actions";

export default async function UsuariosPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { data } = await supabase.from("profiles").select("*").order("created_at");
  const usuarios = (data ?? []) as Profile[];

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-semibold text-[var(--ink-000)]">Usuários</h1>
      <p className="mt-1 mb-8 text-sm text-white/40">
        Gerencie quem tem acesso ao sistema e com qual perfil.
      </p>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Convidar novo acesso</CardTitle>
        </CardHeader>
        <CardBody>
          <form action={criarUsuarioAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_160px_auto] sm:items-end">
            <Field label="Nome">
              <Input name="nome" required placeholder="Nome completo" />
            </Field>
            <Field label="E-mail">
              <Input type="email" name="email" required placeholder="pessoa@empresa.com" />
            </Field>
            <Field label="Perfil">
              <Select name="role" required defaultValue="">
                <option value="" disabled>
                  Selecionar
                </option>
                <option value="rh">RH</option>
                <option value="gestor">Gestor</option>
                <option value="financeiro">Financeiro</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
            <Button type="submit">
              <UserPlus size={15} />
              Convidar
            </Button>
          </form>
          <p className="mt-3 text-xs text-white/35">
            A pessoa recebe um e-mail para definir a própria senha e acessar o sistema.
          </p>
        </CardBody>
      </Card>

      <div className="space-y-2.5">
        {usuarios.map((u) => (
          <Card key={u.id}>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--ink-000)]">{u.nome}</p>
                <p className="mt-0.5 text-xs text-white/40">
                  {u.ativo ? <Pill tone="accent">Ativo</Pill> : <Pill>Desativado</Pill>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <form action={atualizarPapelAction} className="flex items-center gap-2">
                  <input type="hidden" name="user_id" value={u.id} />
                  <Select name="role" defaultValue={u.role} className="!py-1.5 !text-xs w-32">
                    <option value="rh">RH</option>
                    <option value="gestor">Gestor</option>
                    <option value="financeiro">Financeiro</option>
                    <option value="admin">Admin</option>
                  </Select>
                  <Button type="submit" size="sm" variant="secondary">
                    Salvar
                  </Button>
                </form>
                <form action={alternarAtivoAction}>
                  <input type="hidden" name="user_id" value={u.id} />
                  <input type="hidden" name="ativo" value={String(u.ativo)} />
                  <Button type="submit" size="sm" variant={u.ativo ? "danger" : "secondary"}>
                    {u.ativo ? "Desativar" : "Reativar"}
                  </Button>
                </form>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
