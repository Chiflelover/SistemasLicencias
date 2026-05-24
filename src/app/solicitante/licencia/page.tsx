import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ApplicationRepository } from "@/repositories/application.repository";
import { Download, RefreshCcw, AlertTriangle, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LicenciaPage() {
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
          <p className="text-xs uppercase tracking-[0.35em] text-amber-400 font-semibold mb-2">Mi licencia</p>
          <h1 className="text-3xl font-bold text-white">Licencia comercial y renovaciones</h1>
          <p className="mt-2 text-slate-400 max-w-2xl">
            Revisa el estado de tu licencia, descarga el PDF y realiza la renovación cuando el sistema lo indique.
          </p>
        </div>
      </div>

      {!application ? (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <AlertTriangle className="w-5 h-5" />
            No se encontró un trámite activo
          </div>
          <p className="mt-3 text-slate-300">Debes iniciar un trámite para acceder a la información de tu licencia.</p>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-slate-850 bg-slate-900/40 p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-slate-950/60 p-3 text-amber-300">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Trámite</p>
                <p className="mt-2 text-lg font-semibold text-white">{application.number}</p>
                <p className="mt-1 text-slate-400">Estado: {application.status.replaceAll("_", " ")}</p>
              </div>
            </div>

            {application.license ? (
              <div className="space-y-4 rounded-3xl border border-slate-850 bg-slate-950/30 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Número de licencia</p>
                    <p className="mt-2 text-xl font-semibold text-white">{application.license.licenseNumber}</p>
                  </div>
                  <a
                    href={`/api/solicitante/licencia/${application.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
                  >
                    <Download className="w-4 h-4" />
                    Descargar PDF
                  </a>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Emitida</p>
                    <p className="mt-2 text-white">{new Date(application.license.issuedAt).toLocaleDateString("es-PE")}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Vence</p>
                    <p className="mt-2 text-white">{new Date(application.license.expiresAt).toLocaleDateString("es-PE")}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Estado</p>
                    <p className="mt-2 text-white">{application.license.status.replaceAll("_", " ")}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-850 bg-slate-950/30 p-6 text-slate-300">
                <p className="font-semibold text-white">Aún no se ha generado tu licencia</p>
                <p className="mt-2">Termina el flujo de pago e inspección para que el inspector apruebe y el sistema emita el PDF.</p>
              </div>
            )}

            {application.status === "RENEWAL_AVAILABLE" && (
              <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200">
                <div className="flex items-center gap-3">
                  <RefreshCcw className="w-5 h-5" />
                  <div>
                    <p className="font-semibold">Renovación disponible</p>
                    <p className="text-sm text-slate-200 mt-1">Realiza el pago de renovación para extender la vigencia de tu licencia un año más.</p>
                  </div>
                </div>
                <div className="mt-5">
                  <a
                    href="/solicitante/pago"
                    className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
                  >
                    Realizar pago de renovación
                  </a>
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-850 bg-slate-900/40 p-6">
              <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Acciones rápidas</p>
              <div className="mt-4 space-y-3 text-slate-300 text-sm">
                <p>
                  • Si ya pagaste, revisa la bandeja de inspecciones para el turno asignado.
                </p>
                <p>• Si tu licencia expiró, el sistema mostrará el estado como EXPIRED.</p>
                <p>• El PDF se genera automáticamente luego de la aprobación de inspección.</p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
