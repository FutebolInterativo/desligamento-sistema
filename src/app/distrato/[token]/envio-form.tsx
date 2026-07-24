"use client";

import { useActionState } from "react";
import { UploadCloud, CheckCircle2 } from "lucide-react";
import { enviarDistratoAction } from "./actions";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

type Result = { ok: boolean; message: string } | null;

export function EnvioDistratoForm({ token }: { token: string }) {
  const [result, formAction, pending] = useActionState<Result, FormData>(
    async (_prev, formData) => enviarDistratoAction(formData),
    null
  );

  if (result?.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] px-6 py-10 text-center">
        <CheckCircle2 size={28} className="text-emerald-400" />
        <p className="text-sm text-emerald-200">{result.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {result && !result.ok && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-xs text-red-300">
          {result.message}
        </p>
      )}
      <Field label="Distrato elaborado (PDF)">
        <Input type="file" name="arquivo" accept="application/pdf" required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        <UploadCloud size={15} />
        {pending ? "Enviando..." : "Enviar distrato"}
      </Button>
    </form>
  );
}
