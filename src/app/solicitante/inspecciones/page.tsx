import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ApplicationRepository } from "@/repositories/application.repository";
import { CalendarDays, ClipboardList, FileCheck2 } from "lucide-react";

export const dynamic = "force-dynamic";

type InspectionForView = {
  id: string;
  type: string;
  status: string;
  scheduledAt: Date | string;
  observations: string | null;
  inspector?: {
    fullName: string;
  } | null;
};

function formatApplicationStatus(status?: string | null) {
  const statuses: Record<string, string> = {
    DRAFT: "BORRADOR",
    PENDING_PAYMENT: "PAGO PENDIENTE",
    PAYMENT_COMPLETED: "PAGO COMPLETADO",
    INSPECTION_SCHEDULED: "INSPECCIÓN PROGRAMADA",
    SECOND_INSPECTION_SCHEDULED: "SEGUNDA INSPECCIÓN PROGRAMADA",
    FIRST_INSPECTION_REJECTED: "PRIMERA INSPECCIÓN RECHAZADA",
    LICENSE_ISSUED: "LICENCIA EMITIDA",
    RENEWAL_AVAILABLE: "RENOVACIÓN DISPONIBLE",
    EXPIRED: "VENCIDA",
    DEFINITIVELY_REJECTED: "RECHAZADA DEFINITIVAMENTE",
  };

  if (!status) return "SIN ESTADO";
  return statuses[status] || status.replaceAll("_", " ");
}

function formatInspectionType(type?: string | null) {
  const types: Record<string, string> = {
    FIRST: "PRIMERA INSPECCIÓN",
    SECOND: "SEGUNDA INSPECCIÓN",
    SURPRISE: "INSPECCIÓN INOPINADA",
  };

  if (!type) return "INSPECCIÓN";
  return types[type] || type.replaceAll("_", " ");
}

function formatInspectionStatus(status?: string | null) {
  const statuses: Record<string, string> = {
    SCHEDULED: "PROGRAMADA",
    APPROVED: "APROBADA",
    REJECTED: "RECHAZADA",
    COMPLETED: "COMPLETADA",
    CANCELLED: "CANCELADA",
  };

  if (!status) return "SIN ESTADO";
  return statuses[status] || status.replaceAll("_", " ");
}

function formatDate(date?: Date | string | null) {
  if (!date) return "Sin fecha";

  return new Date(date).toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function InspeccionesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "APPLICANT") {
    redirect("/login");
  }

  const application = await ApplicationRepository.findByApplicantId(user.id);

  const inspections = (application?.inspections ?? []) as InspectionForView[];

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="rounded-3xl border border-slate-850 bg-slate-900/40 p-6">
        <p className="text-xs uppercase tracking-[0.35em] text-amber-400 font-semibold mb-2">
          Inspecciones
        </p>

        <h1 className="text-3xl font-bold text-white">
          Estado de inspecciones
        </h1>

        <p className="mt-2 text-slate-400 max-w-3xl">
          Revisa el historial de inspecciones programadas y sus resultados para
          tu trámite.
        </p>
      </div>

      {!application ? (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          No se encontró un trámite activo. Primero debes registrar un negocio.
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-850 bg-slate-900/40 p-6">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-500">
                Trámite
              </p>

              <p className="mt-4 text-2xl font-bold text-white">
                {application.number}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-850 bg-slate-900/40 p-6">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-500">
                Estado actual
              </p>

              <p className="mt-4 text-2xl font-bold text-white">
                {formatApplicationStatus(application.status)}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-850 bg-slate-900/40 p-6">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-500">
                Total inspecciones
              </p>

              <p className="mt-4 text-2xl font-bold text-white">
                {inspections.length}
              </p>
            </div>
          </div>

          {inspections.length === 0 ? (
            <div className="rounded-3xl border border-slate-850 bg-slate-900/40 p-6 text-slate-300">
              <div className="flex items-start gap-3">
                <ClipboardList className="w-6 h-6 text-amber-300 shrink-0 mt-1" />

                <div>
                  <p className="font-bold text-white">
                    Aún no hay inspecciones programadas
                  </p>

                  <p className="mt-2 text-sm text-slate-400">
                    Cuando completes el pago, el sistema programará la
                    inspección municipal automáticamente.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {inspections.map((inspection: InspectionForView) => (
                <div
                  key={inspection.id}
                  className="rounded-3xl border border-slate-850 bg-slate-900/40 p-6"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.25em] text-slate-500">
                        Inspección
                      </p>

                      <p className="mt-2 text-xl font-bold text-white">
                        {formatInspectionType(inspection.type)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-amber-300">
                      {formatInspectionStatus(inspection.status)}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div>
                      <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-[0.2em]">
                        <CalendarDays className="w-4 h-4" />
                        Programada
                      </div>

                      <p className="mt-2 text-white">
                        {formatDate(inspection.scheduledAt)}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-[0.2em]">
                        <FileCheck2 className="w-4 h-4" />
                        Revisado por
                      </div>

                      <p className="mt-2 text-white">
                        {inspection.inspector?.fullName || "Inspector asignado"}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-[0.2em]">
                        Observaciones
                      </p>

                      <p className="mt-2 text-white">
                        {inspection.observations || "Sin observaciones"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}