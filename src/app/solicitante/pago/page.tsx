import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ApplicationRepository } from "@/repositories/application.repository";
import PayButton from "@/components/PayButton";
import { CheckCircle2, Clock3, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PagoPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "APPLICANT") {
    redirect("/login");
  }

  const application = await ApplicationRepository.findByApplicantId(user.id);
  const uploadedDocuments = application?.documents ?? [];
  const hasFloorPlan = uploadedDocuments.some((document) => document.type === "FLOOR_PLAN");
  const hasRucRecord = uploadedDocuments.some((document) => document.type === "RUC_RECORD");
  const missingDocuments = [
    !hasFloorPlan && "Plano del local",
    !hasRucRecord && "Registro RUC",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/40 p-6 rounded-3xl border border-slate-850">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-amber-400 font-semibold mb-2">Pago simulado</p>
          <h1 className="text-3xl font-bold text-white">Pagar S/2 para tu trámite</h1>
          <p className="mt-2 text-slate-400 max-w-2xl">
            Genera un número de operación y guarda el pago en la base de datos para continuar con el proceso de licencia.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6 rounded-3xl border border-slate-850 bg-slate-900/40 p-6 lg:p-8">
          {!application ? (
            <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
              <div className="flex items-center gap-3 text-sm font-semibold">
                <AlertTriangle className="w-5 h-5" />
                No se encontró un trámite activo
              </div>
              <p className="mt-3 text-slate-300">
                Debes iniciar un trámite de negocio antes de poder realizar el pago simulado.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-850 bg-slate-950/80 p-5 text-slate-200">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Trámite activo</p>
                    <p className="text-xl font-semibold text-white">{application.number}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/80 px-4 py-3 text-sm text-slate-300 border border-slate-850">
                    Estado: <span className="font-semibold text-amber-300">{application.status.replaceAll("_", " ")}</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-850 bg-slate-950/60 p-5">
                  <div className="flex items-center gap-3 text-amber-300 mb-3">
                    <Clock3 className="w-4 h-4" />
                    <span className="font-semibold text-sm">Fecha de creación</span>
                  </div>
                  <p className="text-sm text-slate-400">{new Date(application.createdAt).toLocaleDateString("es-PE")}</p>
                </div>
                <div className="rounded-3xl border border-slate-850 bg-slate-950/60 p-5">
                  <div className="flex items-center gap-3 text-amber-300 mb-3">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-semibold text-sm">Pago requerido</span>
                  </div>
                  <p className="text-sm text-slate-400">S/2.00</p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-850 bg-slate-900/80 p-5 text-slate-300">
                <p className="text-sm">
                  Si el botón está deshabilitado, significa que primero debes subir los documentos requeridos o completar el trámite.
                </p>
                {missingDocuments.length > 0 ? (
                  <div className="mt-3 text-sm text-amber-300">
                    <p className="font-semibold">Documentos que faltan:</p>
                    <ul className="list-disc pl-5 mt-2 text-slate-200">
                      {missingDocuments.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">
                    Ya tienes los documentos necesarios. Si el pago sigue bloqueado, revisa el estado del trámite.
                  </p>
                )}
                <p className="text-sm mt-3 text-slate-400">
                  El número de operación se genera automáticamente cuando haces clic en &quot;Pagar S/2&quot;.
                </p>
              </div>
            </div>
          )}
        </section>

        <PayButton applicationId={application?.id ?? null} applicationStatus={application?.status ?? null} />
      </div>
    </div>
  );
}
