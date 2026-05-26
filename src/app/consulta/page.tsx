import Link from "next/link";
import PublicLicenseSearch from "@/components/PublicLicenseSearch";

export const dynamic = "force-static";

export default function ConsultaPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_.8fr] items-start">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl shadow-amber-500/10">
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 border border-amber-500/20">
                Consulta pública
              </span>

              <h1 className="mt-6 text-4xl font-bold tracking-tight text-white">
                Busca tu licencia por RUC o razón social
              </h1>

              <p className="mt-4 text-slate-400 leading-relaxed">
                Ingresa el RUC o la razón social de la empresa para verificar el
                estado de la licencia de funcionamiento. Solo se muestran los
                trámites con licencia emitida en el sistema.
              </p>
            </div>

            <PublicLicenseSearch />
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8">
            <h2 className="text-xl font-semibold text-white">
              ¿Qué puedes consultar?
            </h2>

            <ul className="mt-4 space-y-3 text-slate-400 text-sm">
              <li>• Estado de la licencia de funcionamiento.</li>
              <li>• Dirección comercial registrada.</li>
              <li>• Rubro o actividad del establecimiento.</li>
              <li>• Búsqueda por RUC o razón social.</li>
            </ul>

            <div className="mt-8 rounded-3xl bg-slate-950/80 border border-slate-800 p-6">
              <p className="text-sm text-slate-400">
                ¿No tienes un RUC a la mano?
              </p>

              <p className="mt-3 text-slate-200 leading-relaxed">
                Busca con la razón social completa o parcial. El sistema
                mostrará hasta 20 resultados coincidentes.
              </p>
            </div>

            <Link
              href="/"
              prefetch={false}
              className="mt-8 inline-flex text-sm font-semibold text-amber-400 hover:text-amber-300"
            >
              Volver a portada
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}