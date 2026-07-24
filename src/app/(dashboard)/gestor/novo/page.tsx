import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { registrarDesligamentoAction } from "../actions";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { CondicoesAcordadasFields } from "./condicoes-acordadas-fields";

export default async function NovoDesligamentoPage() {
  await requireRole(["gestor", "admin"]);

  return (
    <div className="max-w-2xl">
      <Link
        href="/gestor"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70"
      >
        <ArrowLeft size={14} />
        Voltar
      </Link>

      <h1 className="font-display text-2xl font-semibold text-[var(--ink-000)]">
        Registrar desligamento
      </h1>
      <p className="mt-1 mb-8 text-sm text-white/40">
        Registre o que foi conversado e acordado. O RH recebe este relatório automaticamente.
      </p>

      <form action={registrarDesligamentoAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Colaborador</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo">
              <Input name="nome_colaborador" required placeholder="Nome do colaborador" />
            </Field>
            <Field label="Cargo">
              <Input name="cargo" placeholder="Ex.: Analista de Marketing" />
            </Field>
            <Field
              label="Tipo de vínculo"
              hint="Define se o colaborador precisa emitir nota fiscal"
            >
              <Select name="tipo_vinculo" defaultValue="clt" required>
                <option value="clt">CLT</option>
                <option value="pj">PJ</option>
                <option value="estagio">Estágio</option>
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversa de desligamento</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data da conversa">
                <Input type="date" name="data_conversa" required />
              </Field>
              <Field label="Último dia trabalhado (se já definido)">
                <Input type="date" name="data_ultimo_dia" />
              </Field>
            </div>
            <Field label="Motivo do desligamento" hint="Opcional">
              <Textarea name="motivo" placeholder="Contexto do desligamento, se relevante" />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Condições acordadas</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <CondicoesAcordadasFields />
          </CardBody>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/gestor">
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </Link>
          <Button type="submit">Enviar para o RH</Button>
        </div>
      </form>
    </div>
  );
}