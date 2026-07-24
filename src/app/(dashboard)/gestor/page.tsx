import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import type { Desligamento, Colaborador } from "@/lib/types";

export default async function GestorPage() {
  const profile = await requireRole(["gestor", "admin"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("desligamentos")
    .select("*, colaborador:colaboradores(*)")
    .eq("gestor_id", profile.id)
    .order("created_at", { ascending: false });

  const desligamentos = (data ?? []) as (Desligamento & { colaborador: Colaborador })[];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--ink-000)]">
            Meus desligamentos
          </h1>
          <p className="mt-1 text-sm text-white/40">
            Conversas de desligamento registradas por você e o andamento de cada uma.
          </p>
        </div>
        <Link href="/gestor/novo">
          <Button>
            <Plus size={16} />
            Registrar desligamento
          </Button>
        </Link>
      </div>

      {desligamentos.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum desligamento registrado ainda"
          description="Quando você tiver uma conversa de desligamento com um colaborador, registre aqui os detalhes acordados."
        />
      ) : (
        <div className="space-y-3">
          {desligamentos.map((d) => (
            <Link key={d.id} href={`/gestor/${d.id}`} className="block">
              <Card className="cursor-pointer transition-colors hover:border-[var(--blue-400)]/40">
                <CardBody className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-sm font-medium text-[var(--ink-000)]">
                      {d.colaborador?.nome}
                    </p>
                    <p className="mt-0.5 text-xs text-white/40">
                      {d.colaborador?.cargo ?? "Sem cargo informado"} · conversa em{" "}
                      {formatDate(d.data_conversa)}
                    </p>
                  </div>
                  <StatusBadge status={d.status} />
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
