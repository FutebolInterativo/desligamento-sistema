import Link from "next/link";
import { Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import type { Desligamento, Colaborador } from "@/lib/types";

export default async function FinanceiroPage() {
  await requireRole(["financeiro", "admin"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("desligamentos")
    .select("*, colaborador:colaboradores(*)")
    .neq("status", "conversa_registrada")
    .order("created_at", { ascending: false });

  const desligamentos = (data ?? []) as (Desligamento & { colaborador: Colaborador })[];

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-[var(--ink-000)]">
        Valores e pagamentos
      </h1>
      <p className="mt-1 mb-8 text-sm text-white/40">
        Desligamentos que precisam de valores calculados, NF ou registro de pagamento.
      </p>

      {desligamentos.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nada pendente por aqui"
          description="Quando o RH encaminhar um desligamento, ele aparece nesta lista."
        />
      ) : (
        <div className="space-y-2.5">
          {desligamentos.map((d) => (
            <Link key={d.id} href={`/financeiro/${d.id}`}>
              <Card className="transition-colors hover:border-[var(--blue-600)]/40">
                <CardBody className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-sm font-medium text-[var(--ink-000)]">
                      {d.colaborador?.nome}
                    </p>
                    <p className="mt-0.5 text-xs text-white/40">
                      conversa em {formatDate(d.data_conversa)}
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
