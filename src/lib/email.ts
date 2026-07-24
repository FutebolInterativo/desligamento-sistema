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

export function emailSolicitacaoAdvogado(params: {
  advogadoNome: string;
  colaboradorNome: string;
  link: string;
  condicoes: string | null;
  temMulta: boolean;
  multaResponsavel: "colaborador" | "empresa" | null;
  temAcordo: boolean;
  valorTotal: number | null;
  prazoLimite: string | null;
}) {
  const multaLabel = params.temMulta
    ? params.multaResponsavel === "empresa"
      ? "Sim — multa paga pela FI"
      : params.multaResponsavel === "colaborador"
      ? "Sim — multa paga pelo colaborador"
      : "Sim — responsável pelo pagamento não informado"
    : "Não";

  return `
    <div style="font-family: Arial, sans-serif; color: #04133A; max-width: 560px;">
      <h2 style="color:#0075ED;">Solicitação de elaboração de distrato</h2>
      <p>Olá, ${params.advogadoNome}.</p>
      <p>O RH solicita a elaboração do distrato de desligamento com os dados abaixo:</p>
      <ul>
        <li><strong>Colaborador:</strong> ${params.colaboradorNome}</li>
        <li><strong>Multa:</strong> <span style="${
          params.temMulta ? "background:#FEF3C7;color:#92400E;padding:1px 6px;border-radius:4px;" : ""
        }">${multaLabel}</span></li>
        <li><strong>Acordo específico:</strong> ${params.temAcordo ? "Sim" : "Não"}</li>
        <li><strong>Condições acordadas:</strong> ${params.condicoes ?? "—"}</li>
        <li><strong>Valor total apurado:</strong> ${
          params.valorTotal != null ? `R$ ${params.valorTotal.toFixed(2)}` : "a definir"
        }</li>
        ${params.prazoLimite ? `<li><strong>Prazo estimado:</strong> ${params.prazoLimite}</li>` : ""}
      </ul>
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