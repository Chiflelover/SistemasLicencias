import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Licencias Municipales - Trujillo",
  description: "Sistema de otorgamiento de licencias municipales",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        <div className="fixed top-4 left-4 z-50">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/90 px-4 py-2 text-sm font-semibold text-slate-100 shadow-xl shadow-slate-950/30 transition hover:bg-slate-900"
          >
            Inicio
          </Link>
        </div>
        {children}
      </body>
    </html>
  );
}
