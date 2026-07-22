import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import BajaLicencia from "@/components/BajaLicencia";

export const dynamic = "force-dynamic";

export default function BajaLicenciaPage() {
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
          Dar de baja una licencia
        </h1>

        {/* El caso que motiva la pantalla, dicho de entrada: la licencia vale
            para el establecimiento y no para la empresa (Ley 28976). */}
        <p className="mt-1 text-sm text-slate-400">
          Termina una licencia antes de tiempo y libera el RUC. Es lo que
          corresponde cuando el negocio se muda: la licencia vale para el local,
          así que en el nuevo hay que tramitar otra. No tiene costo.
        </p>
      </div>

      <BajaLicencia />
    </div>
  );
}
