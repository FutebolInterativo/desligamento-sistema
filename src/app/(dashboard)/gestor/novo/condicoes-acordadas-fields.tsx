"use client";

import { useState } from "react";
import { Field, Textarea, Checkbox, Select } from "@/components/ui/form";

export function CondicoesAcordadasFields() {
  const [temMulta, setTemMulta] = useState(false);

  return (
    <>
      <div className="flex gap-6">
        <Checkbox
          name="tem_multa"
          label="Há multa envolvida"
          checked={temMulta}
          onChange={(e) => setTemMulta(e.target.checked)}
        />
        <Checkbox name="tem_acordo" label="Há acordo específico" />
      </div>
      {temMulta && (
        <Field label="Quem paga a multa">
          <Select name="multa_responsavel" defaultValue="" required>
            <option value="" disabled>
              Selecione
            </option>
            <option value="colaborador">Colaborador paga a multa</option>
            <option value="empresa">FI paga a multa</option>
          </Select>
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