import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SubsanarTramite from "@/components/SubsanarTramite";

export const dynamic = "force-dynamic";

export default function SubsanarPage() {
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
          Subsanar documentos de trámite
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Buscá un trámite observado en la inspección para volver a subir los
          documentos corregidos.
        </p>
      </div>

      <SubsanarTramite />
    </div>
  );
}
