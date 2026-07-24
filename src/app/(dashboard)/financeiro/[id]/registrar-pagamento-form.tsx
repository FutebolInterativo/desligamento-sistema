"use client";

import { useActionState, useRef, useEffect } from "react";
import { CircleDollarSign, CheckCircle2 } from "lucide-react";
import { registrarParcelaAction } from "../actions";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { formatBRL, formatDate } from "@/lib/utils";
import type { ParcelaPagamento } from "@/lib/types";

type Result = { ok: boolean; message: string } | null;

export function RegistrarPagamentoForm({
  desligamentoId,
  distratoAprovado,
  nfPendente,
  parcelas,
  valorTotal,
}: {
  desligamentoId: string;
  distratoAprovado: boolean;
  nfPendente: boolean;
  parcelas: ParcelaPagamento[];
  valorTotal: number | null;
}) {
  const [result, formAction, pending] = useActionState<Result, FormData>(
    registrarParcelaAction,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (result?.ok) formRef.current?.reset();
  }, [result]);

  const totalPago = parcelas
    .filter((p) => p.status === "pago")
    .reduce((acc, p) => acc + Number(p.valor), 0);
  const restante = valorTotal != null ? Math.max(valorTotal - totalPago, 0) : null;
  const quitado = valorTotal != null && totalPago >= valorTotal;

  return (
    <div className="space-y-4 border-t border-white/[0.06] pt-4">
      {parcelas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-mono-label text-white/40">Parcelas registradas</p>
          {parcelas.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-[var(--midnight)]/40 px-3 py-2 text-sm"
            >
              <span className="text-white/70">
                Parcela {p.numero_parcela} · {formatDate(p.data_realizado)}
              </span>
              <span className="font-display text-[var(--ink-000)]">{formatBRL(p.valor)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-sm pt-1">
            <span className="text-white/40">Total pago</span>
            <span className="text-white/85">{formatBRL(totalPago)}</span>
          </div>
          {restante != null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/40">Restante</span>
              <span className={restante > 0 ? "text-amber-300" : "text-emerald-300"}>
                {formatBRL(restante)}
              </span>
            </div>
          )}
        </div>
      )}

      {quitado ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2.5 text-sm text-emerald-300">
          <CheckCircle2 size={15} />
          Valor total quitado — pagamento concluído.
        </div>
      ) : (
        <form ref={formRef} action={formAction} className="space-y-3">
          <input type="hidden" name="desligamento_id" value={desligamentoId} />
          {result && !result.ok && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-300">
              {result.message}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor da parcela" hint="Pode registrar mais de uma parcela, se for parcelado">
              <Input type="number" step="0.01" name="valor" required />
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
            {pending ? "Registrando..." : "Registrar parcela"}
          </Button>
        </form>
      )}
    </div>
  );
}
