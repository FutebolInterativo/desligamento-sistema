import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Distrato — Fluxo de Desligamento",
  description: "Sistema interno de gestão do processo de desligamento",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
