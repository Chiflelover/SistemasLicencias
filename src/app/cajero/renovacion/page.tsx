import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import RenovacionLicencia from "@/components/RenovacionLicencia";

export const dynamic = "force-dynamic";

export default function RenovacionPage() {
  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl">
      <div>
        <Link
          href="/cajero"
          className="text-sm text-slate-400 hover:text-white inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al panel
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-white">
          Renovación de licencia
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Consulta el RUC para renovar una licencia vencida: documentos
          actualizados si hubo cambios, y el cobro de la tasa.
        </p>
      </div>

      <RenovacionLicencia />
    </div>
  );
}
