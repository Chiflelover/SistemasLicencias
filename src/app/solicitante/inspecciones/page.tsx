import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ApplicationRepository } from "@/repositories/application.repository";
import { FileSearch, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InspeccionesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (user.role !== "APPLICANT") {
    redirect("/login");
  }

  const application = await ApplicationRepository.findByApplicantId(user.id);

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/40 p-6 rounded-3xl border border-slate-850">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-amber-400 font-semibold mb-2">Inspecciones</p>
          <h1 className="text-3xl font-bold text-white">Estado de inspecciones</h1>
          <p className="mt-2 text-slate-400 max-w-2xl">
            Revisa el historial de inspecciones programadas y sus resultados para tu trámite.
          </p>
        </div>
      </div>

      {!application ? (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <AlertCircle className="w-5 h-5" />
            No se encontró un trámite activo
          </div>
          <p className="mt-3 text-slate-300">Registra primero un trámite para ver las inspecciones asociadas.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-slate-850 bg-slate-900/40 p-6">
              <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Trámite</p>
              <p className="mt-3 text-xl font-semibold text-white">{application.number}</p>
            </div>
            <div className="rounded-3xl border border-slate-850 bg-slate-900/40 p-6">
              <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Estado actual</p>
              <p className="mt-3 text-xl font-semibold text-white">{application.status.replaceAll("_", " ")}</p>
            </div>
            <div className="rounded-3xl border border-slate-850 bg-slate-900/40 p-6">
              <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Total inspecciones</p>
              <p className="mt-3 text-xl font-semibold text-white">{application.inspections.length}</p>
            </div>
          </div>

          {application.inspections.length === 0 ? (
            <div className="rounded-3xl border border-slate-850 bg-slate-950/40 p-8 text-slate-400">
              <div className="flex items-center gap-3 text-amber-300 mb-3">
                <FileSearch className="w-5 h-5" />
                <p className="font-semibold">No hay inspecciones programadas aún</p>
              </div>
              <p>Completa el pago simulado para que el sistema programe la inspección automáticamente.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {application.inspections.map((inspection) => (
                <div key={inspection.id} className="rounded-3xl border border-slate-850 bg-slate-900/40 p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Inspección</p>
                      <p className="text-lg font-semibold text-white">{inspection.number.replaceAll("_", " ")}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/80 px-4 py-3 text-sm text-slate-300 border border-slate-850">
                      {inspection.status} {inspection.result ? `· ${inspection.result}` : ""}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Programada</p>
                      <p className="mt-2 text-white">{new Date(inspection.scheduledAt).toLocaleString("es-PE")}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Observaciones</p>
                      <p className="mt-2 text-slate-300">{inspection.observations || "Sin observaciones"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Revisado por</p>
                      <p className="mt-2 text-white">{inspection.inspector?.fullName || "Pendiente"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
