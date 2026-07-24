// Envio de e-mail transacional. Usa Resend por padrão (troque pelo provedor
// de sua preferência — SendGrid, Postmark etc. têm APIs equivalentes).
// Se RESEND_API_KEY não estiver configurada, a função apenas loga no
// console em vez de falhar — útil em desenvolvimento local.

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[];
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "distrato@empresa.com";

  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY não configurada — e-mail não enviado.\nPara: ${params.to}\nAssunto: ${params.subject}\n`
    );
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(params.attachments ? { attachments: params.attachments } : {}),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao enviar e-mail: ${text}`);
  }

  return response.json();
}

import { formatBRL, formatDate } from "@/lib/utils";

const TIPO_VINCULO_LABEL: Record<string, string> = {
  clt: "CLT",
  pj: "PJ",
  estagio: "Estágio",
  outro: "Outro",
};

export function emailSolicitacaoAdvogado(params: {
  advogadoNome: string;
  link: string;
  prazoLimite: string | null;
  observacoes: string | null;
  dados: {
    colaborador?: string | null;
    cargo?: string | null;
    cpf?: string | null;
    tipo_vinculo?: string | null;
    data_conversa?: string | null;
    data_ultimo_dia_trabalhado?: string | null;
    motivo?: string | null;
    condicoes?: string | null;
    tem_multa?: boolean;
    multa_responsavel?: "colaborador" | "empresa" | null;
    tem_acordo?: boolean;
    salario_base?: number | null;
    dias_trabalhados?: number | null;
    valor_multa?: number | null;
    valor_acordo?: number | null;
    valor_total?: number | null;
  };
}) {
  const d = params.dados;

  const multaLabel = d.tem_multa
    ? d.multa_responsavel === "empresa"
      ? "Sim — multa paga pela FI"
      : d.multa_responsavel === "colaborador"
      ? "Sim — multa paga pelo colaborador"
      : "Sim — responsável pelo pagamento não informado"
    : "Não";

  const temValores = d.salario_base != null;

  return `
    <div style="font-family: Arial, sans-serif; color: #04133A; max-width: 560px;">
      <h2 style="color:#0075ED;">Solicitação de elaboração de distrato</h2>
      <p>Olá, ${params.advogadoNome}.</p>
      <p>O RH solicita a elaboração do distrato de desligamento com os dados abaixo:</p>

      <h3 style="color:#0075ED;font-size:14px;margin-bottom:4px;">Dados do colaborador</h3>
      <ul style="margin-top:4px;">
        <li><strong>Nome:</strong> ${d.colaborador ?? "—"}</li>
        <li><strong>Cargo:</strong> ${d.cargo ?? "—"}</li>
        <li><strong>CPF:</strong> ${d.cpf ?? "não informado"}</li>
        <li><strong>Tipo de vínculo:</strong> ${
          d.tipo_vinculo ? TIPO_VINCULO_LABEL[d.tipo_vinculo] ?? d.tipo_vinculo : "—"
        }</li>
        <li><strong>Data da conversa de desligamento:</strong> ${formatDate(d.data_conversa)}</li>
        <li><strong>Último dia trabalhado:</strong> ${formatDate(d.data_ultimo_dia_trabalhado)}</li>
        ${d.motivo ? `<li><strong>Motivo do desligamento:</strong> ${d.motivo}</li>` : ""}
      </ul>

      <h3 style="color:#0075ED;font-size:14px;margin-bottom:4px;">Acordo e condições</h3>
      <ul style="margin-top:4px;">
        <li><strong>Multa:</strong> <span style="${
          d.tem_multa ? "background:#FEF3C7;color:#92400E;padding:1px 6px;border-radius:4px;" : ""
        }">${multaLabel}</span></li>
        <li><strong>Acordo específico:</strong> ${d.tem_acordo ? "Sim" : "Não"}</li>
        <li><strong>Condições acordadas:</strong> ${d.condicoes ?? "—"}</li>
      </ul>

      <h3 style="color:#0075ED;font-size:14px;margin-bottom:4px;">Valores</h3>
      ${
        temValores
          ? `
      <ul style="margin-top:4px;">
        <li><strong>Salário base:</strong> ${formatBRL(d.salario_base)}</li>
        <li><strong>Dias trabalhados no mês:</strong> ${d.dias_trabalhados ?? "a confirmar pelo RH"}</li>
        <li><strong>Valor de multa:</strong> ${formatBRL(d.valor_multa)}</li>
        <li><strong>Valor de acordo:</strong> ${formatBRL(d.valor_acordo)}</li>
        <li><strong>Valor total apurado:</strong> ${formatBRL(d.valor_total)}</li>
      </ul>`
          : `<p style="color:#667;">Ainda não apurados pelo financeiro — a definir.</p>`
      }

      ${params.prazoLimite ? `<p><strong>Prazo estimado:</strong> ${formatDate(params.prazoLimite)}</p>` : ""}
      ${params.observacoes ? `<p><strong>Observações do RH:</strong> ${params.observacoes}</p>` : ""}

      <p>Para anexar o distrato elaborado, acesse o link exclusivo abaixo:</p>
      <p><a href="${params.link}" style="background:#0075ED;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Anexar distrato</a></p>
      <p style="color:#667;font-size:12px;">Este link é de uso exclusivo para este caso e não expira por tempo.</p>
    </div>
  `;
}

export function emailDistratoAssinado(params: {
  advogadoNome: string;
  colaboradorNome: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; color: #04133A; max-width: 560px;">
      <h2 style="color:#0075ED;">Distrato assinado</h2>
      <p>Olá, ${params.advogadoNome}.</p>
      <p>
        Segue em anexo o distrato de desligamento de <strong>${params.colaboradorNome}</strong>
        assinado por todas as partes, para conhecimento e arquivo.
      </p>
    </div>
  `;
}