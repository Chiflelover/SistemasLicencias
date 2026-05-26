import Link from "next/link";
import { ApplicationRepository } from "@/repositories/application.repository";

interface ConsultaPageProps {
  searchParams?: {
    q?: string;
  };
}

const formatStatus = (status: string) => {
  switch (status) {
    case "ACTIVE":
      return "Activa";
    case "RENEWAL_AVAILABLE":
      return "Renovación disponible";
    case "EXPIRED":
      return "Vencida";
    default:
      return status;
  }
};

export default async function ConsultaPage({ searchParams }: ConsultaPageProps) {
  const query = searchParams?.q?.trim() ?? "";
  const results = query ? await ApplicationRepository.searchPublic(query) : [];

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
                Ingresa el RUC o la razón social de la empresa para verificar el estado de la licencia de funcionamiento.
                Solo se muestran los trámites con licencia emitida en el sistema.
              </p>
            </div>

            <form action="/consulta" className="grid gap-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-200">RUC o razón social</span>
                <input
                  name="q"
                  defaultValue={query}
                  type="text"
                  placeholder="Ej. 12345678901 o COMERCIAL ABC S.A."
                  className="mt-3 w-full rounded-3xl border border-slate-800 bg-slate-900/80 px-4 py-4 text-slate-100 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                />
              </label>

              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-3xl bg-amber-500 px-5 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-amber-400"
              >
                Buscar
              </button>
            </form>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8">
            <h2 className="text-xl font-semibold text-white">¿Qué puedes consultar?</h2>
            <ul className="mt-4 space-y-3 text-slate-400 text-sm">
              <li>• Estado de la licencia de funcionamiento.</li>
              <li>• Dirección comercial registrada.</li>
              <li>• Rubro o actividad del establecimiento.</li>
              <li>• Búsqueda por RUC o razón social.</li>
            </ul>
            <div className="mt-8 rounded-3xl bg-slate-950/80 border border-slate-800 p-6">
              <p className="text-sm text-slate-400">¿No tienes un RUC a la mano?</p>
              <p className="mt-3 text-slate-200 leading-relaxed">
                Busca con la razón social completa o parcial. El sistema mostrará hasta 20 resultados coincidentes.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12">
          {query ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-400">Resultados para:</p>
                  <p className="text-lg font-semibold text-white">{query}</p>
                </div>
                <Link
                  href="/"
                  className="text-sm font-semibold text-amber-400 hover:text-amber-300"
                >
                  Volver a portada
                </Link>
              </div>

              {results.length === 0 ? (
                <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
                  No se encontraron búsquedas con ese RUC o razón social.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/80 shadow-lg shadow-slate-950/20">
                  <table className="min-w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950/90 text-slate-400 uppercase tracking-[0.18em] text-xs">
                      <tr>
                        <th className="px-4 py-4">Razón social</th>
                        <th className="px-4 py-4">Dirección</th>
                        <th className="px-4 py-4">Estado licencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/80">
                      {results.map((application) => (
                        <tr key={application.id} className="hover:bg-slate-900/60">
                          <td className="px-4 py-4 text-white">{application.business.legalName}</td>
                          <td className="px-4 py-4 text-slate-300">{application.business.commercialAddress ?? "No registrada"}</td>
                          <td className="px-4 py-4 text-amber-300">{formatStatus(application.license?.status ?? "-")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-slate-400">
              Ingresa un RUC o razón social para comenzar la búsqueda.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
