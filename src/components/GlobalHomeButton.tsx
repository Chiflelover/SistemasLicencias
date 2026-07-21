"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home } from "lucide-react";

export default function GlobalHomeButton() {
  const pathname = usePathname();

  /**
   * Las áreas autenticadas ya tienen su propio botón de Inicio en la barra
   * superior: mostrar además el flotante duplicaba la misma acción.
   */
  const AREAS_CON_NAVBAR = ["/inspector", "/cajero", "/admin", "/dev"];

  if (AREAS_CON_NAVBAR.some((area) => pathname.startsWith(area))) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 z-50">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/95 px-3 py-2 text-sm font-semibold text-slate-100 shadow-lg shadow-slate-950/30 backdrop-blur-md transition hover:bg-slate-900"
      >
        <Home className="w-4 h-4" />
        Inicio
      </Link>
    </div>
  );
}
