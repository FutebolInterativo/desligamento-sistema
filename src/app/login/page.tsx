import { Scale } from "lucide-react";
import { loginAction } from "./actions";
import { Input, Field } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

const ERROR_MESSAGE: Record<string, string> = {
  credenciais: "E-mail ou senha incorretos.",
  inativo: "Este acesso foi desativado. Fale com o administrador do sistema.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--blue-600)] shadow-[0_0_28px_rgba(0,117,237,0.55)]">
            <Scale size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold text-[var(--ink-000)]">
              Fluxo de Desligamento
            </h1>
            <p className="mt-1 text-sm text-white/40">Acesso restrito — RH, Gestor, Financeiro e Admin</p>
          </div>
        </div>

        <form action={loginAction} className="space-y-4 rounded-2xl border border-white/[0.06] bg-[var(--navy-900)]/60 p-6">
          {erro && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-xs text-red-300">
              {ERROR_MESSAGE[erro] ?? "Não foi possível entrar."}
            </p>
          )}
          <Field label="E-mail">
            <Input type="email" name="email" required placeholder="voce@empresa.com" autoFocus />
          </Field>
          <Field label="Senha">
            <Input type="password" name="password" required placeholder="••••••••" />
          </Field>
          <Button type="submit" className="w-full mt-2">
            Entrar
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-white/30">
          Advogado externo? O acesso é feito pelo link enviado por e-mail, sem login.
        </p>
      </div>
    </div>
  );
}
