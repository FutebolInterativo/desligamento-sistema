"use client";

import { useState } from "react";
import { Field, Input, Textarea, Checkbox, Select } from "@/components/ui/form";

export function CondicoesAcordadasFields() {
  const [temMulta, setTemMulta] = useState(false);
  const [temAcordo, setTemAcordo] = useState(false);

  return (
    <>
      <div className="flex gap-6">
        <Checkbox
          name="tem_multa"
          label="Há multa envolvida"
          checked={temMulta}
          onChange={(e) => setTemMulta(e.target.checked)}
        />
        <Checkbox
          name="tem_acordo"
          label="Há acordo específico"
          checked={temAcordo}
          onChange={(e) => setTemAcordo(e.target.checked)}
        />
      </div>

      {temMulta && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Quem paga a multa">
            <Select name="multa_responsavel" defaultValue="" required>
              <option value="" disabled>
                Selecione
              </option>
              <option value="colaborador">Colaborador paga a multa</option>
              <option value="empresa">FI paga a multa</option>
            </Select>
          </Field>
          <Field label="Valor da multa">
            <Input type="number" step="0.01" name="valor_multa" min="0" required placeholder="0,00" />
          </Field>
        </div>
      )}

      {temAcordo && (
        <Field label="Valor do acordo" hint="Valor extra negociado, se houver">
          <Input type="number" step="0.01" name="valor_acordo" min="0" placeholder="0,00" />
        </Field>
      )}

      <Field label="Descrição das condições" hint="O que foi acordado entre gestor e colaborador">
        <Textarea
          name="condicoes"
          placeholder="Descreva livremente o que foi combinado na conversa"
        />
      </Field>
    </>
  );
}