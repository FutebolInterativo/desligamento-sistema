"use client";

import { useActionState } from "react";
import { CircleDollarSign, CheckCircle2 } from "lucide-react";
import { registrarPagamentoAction } from "../actions";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

type Result = { ok: boolean; message: string } | null;

export function RegistrarPagamentoForm({
  desligamentoId,
  distratoAprovado,
  nfPendente,
}: {
  desligamentoId: string;
  distratoAprovado: boolean;
  nfPendente: boolean;
}) {
  const [result, formAction, pending] = useActionState<Result, FormData>(
    registrarPagamentoAction,
    null
  );

  if (result?.ok) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2.5 text-sm text-emerald-300">
        <CheckCircle2 size={15} />
        {result.message}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3 border-t border-white/[0.06] pt-4">
      <input type="hidden" name="desligamento_id" value={desligamentoId} />
      {result && !result.ok && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-300">
          {result.message}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor pago">
          <Input type="number" step="0.01" name="valor_pago" required />
        </Field>
        <Field label="Data do pagamento">
          <Input type="date" name="data_realizado" required />
        </Field>
      </div>
      {!distratoAprovado && (
        <p className="text-xs text-amber-300">
          O distrato ainda não está assinado/aprovado — o pagamento será bloqueado pelo sistema até isso ocorrer.
        </p>
      )}
      {nfPendente && (
        <p className="text-xs text-amber-300">
          Este caso exige NF — aguarde o colaborador enviar antes de registrar o pagamento.
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        <CircleDollarSign size={15} />
        {pending ? "Registrando..." : "Registrar pagamento"}
      </Button>
    </form>
  );
}