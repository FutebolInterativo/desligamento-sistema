import { Scale, FileWarning, AlertTriangle } from "lucide-react";
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
  } | null;

  const TIPO_VINCULO_LABEL: Record<string, string> = {
    clt: "CLT",
    pj: "PJ",
    estagio: "Estágio",
    outro: "Outro",
  };

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
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-white/70">
              <p>
                <span className="text-white/40">CPF: </span>
                {dados?.cpf ?? "não informado"}
              </p>
              <p>
                <span className="text-white/40">Vínculo: </span>
                {dados?.tipo_vinculo
                  ? TIPO_VINCULO_LABEL[dados.tipo_vinculo] ?? dados.tipo_vinculo
                  : "—"}
              </p>
              <p>
                <span className="text-white/40">Conversa em: </span>
                {formatDate(dados?.data_conversa)}
              </p>
              <p>
                <span className="text-white/40">Último dia trabalhado: </span>
                {formatDate(dados?.data_ultimo_dia_trabalhado)}
              </p>
            </div>
            {dados?.motivo && (
              <p className="text-white/70">
                <span className="text-white/40">Motivo do desligamento: </span>
                {dados.motivo}
              </p>
            )}
            <div className="flex gap-2">
              <Pill tone={dados?.tem_multa ? "warn" : "neutral"}>
                {dados?.tem_multa ? "Com multa" : "Sem multa"}
              </Pill>
              <Pill tone={dados?.tem_acordo ? "accent" : "neutral"}>
                {dados?.tem_acordo ? "Com acordo específico" : "Sem acordo específico"}
              </Pill>
            </div>
            {dados?.tem_multa && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <AlertTriangle size={16} className="flex-none text-amber-400" />
                <span className="text-sm font-medium text-amber-200">
                  {dados.multa_responsavel === "empresa"
                    ? "A multa é paga pela FI"
                    : dados.multa_responsavel === "colaborador"
                    ? "A multa é paga pelo colaborador"
                    : "Responsável pela multa não informado — confirme com o RH"}
                </span>
              </div>
            )}
            {dados?.condicoes && <p className="text-white/70">{dados.condicoes}</p>}

            <div className="rounded-lg border border-white/10 bg-[var(--midnight)]/40 p-3">
              <p className="mb-1.5 text-xs font-mono-label text-white/40">Valores</p>
              {dados?.salario_base != null ? (
                <div className="space-y-1 text-white/70">
                  <p>
                    <span className="text-white/40">Salário base: </span>
                    {formatBRL(dados.salario_base)}
                  </p>
                  <p>
                    <span className="text-white/40">Dias trabalhados: </span>
                    {dados.dias_trabalhados}
                  </p>
                  <p>
                    <span className="text-white/40">Valor de multa: </span>
                    {formatBRL(dados.valor_multa)}
                  </p>
                  <p>
                    <span className="text-white/40">Valor de acordo: </span>
                    {formatBRL(dados.valor_acordo)}
                  </p>
                  <p className="pt-1 text-[var(--blue-400)]">
                    <span className="text-white/40">Valor total apurado: </span>
                    {formatBRL(dados.valor_total)}
                  </p>
                </div>
              ) : (
                <p className="text-white/40">Ainda não apurados pelo financeiro.</p>
              )}
            </div>

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