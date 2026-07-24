import { Scale, FileWarning } from "lucide-react";
import { buscarSolicitacaoPorToken } from "./actions";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/badge";
import { formatBRL, formatDate } from "@/lib/utils";
import { EnvioDistratoForm } from "./envio-form";

export default async function DistratoTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const solicitacao = await buscarSolicitacaoPorToken(token);

  if (!solicitacao) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <FileWarning size={28} className="text-white/30" />
          <p className="text-sm text-white/50">
            Link inválido ou expirado. Solicite um novo link ao RH.
          </p>
        </div>
      </div>
    );
  }

  const dados = solicitacao.dados_enviados as {
    colaborador?: string;
    cargo?: string;
    condicoes?: string | null;
    tem_multa?: boolean;
    tem_acordo?: boolean;
    valor_total?: number | null;
  } | null;

  const jaEnviado = Boolean(solicitacao.usado_em);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--blue-600)] shadow-[0_0_28px_rgba(0,117,237,0.55)]">
            <Scale size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold text-[var(--ink-000)]">
              Elaboração de distrato
            </h1>
            <p className="mt-1 text-sm text-white/40">Solicitado por: {solicitacao.advogado_nome}</p>
          </div>
        </div>

        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Dados do desligamento</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <p className="text-white/80">
              <span className="text-white/40">Colaborador: </span>
              {dados?.colaborador} {dados?.cargo ? `— ${dados.cargo}` : ""}
            </p>
            <div className="flex gap-2">
              <Pill tone={dados?.tem_multa ? "warn" : "neutral"}>
                {dados?.tem_multa ? "Com multa" : "Sem multa"}
              </Pill>
              <Pill tone={dados?.tem_acordo ? "accent" : "neutral"}>
                {dados?.tem_acordo ? "Com acordo específico" : "Sem acordo específico"}
              </Pill>
            </div>
            {dados?.condicoes && <p className="text-white/70">{dados.condicoes}</p>}
            <p className="text-white/70">
              <span className="text-white/40">Valor total apurado: </span>
              {dados?.valor_total != null ? formatBRL(dados.valor_total) : "a definir pelo financeiro"}
            </p>
            {solicitacao.prazo_limite && (
              <p className="text-xs text-white/35">
                Prazo estimado: {formatDate(solicitacao.prazo_limite)}
              </p>
            )}
            {solicitacao.observacoes && (
              <p className="text-white/70">
                <span className="text-white/40">Observações do RH: </span>
                {solicitacao.observacoes}
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Anexar distrato</CardTitle>
          </CardHeader>
          <CardBody>
            {jaEnviado ? (
              <p className="text-sm text-white/50">
                O distrato já foi enviado por este link em {formatDate(solicitacao.usado_em)}. Caso
                precise reenviar uma versão revisada, solicite um novo link ao RH.
              </p>
            ) : (
              <EnvioDistratoForm token={token} />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
