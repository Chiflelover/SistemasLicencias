import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSystemDate } from "@/lib/date";
import {
  ApplicationStatus,
  InspectionNumber,
  InspectionStatus,
  Role,
} from "@prisma/client";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Home,
  MapPin,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

function formatStatus(status: string) {
  const statuses: Record<string, string> = {
    DRAFT: "BORRADOR",
    DOCUMENTS_COMPLETE: "DOCUMENTOS COMPLETOS",
    PENDING_PAYMENT: "PAGO PENDIENTE",
    PAYMENT_COMPLETED: "PAGO COMPLETADO",
    INSPECTION_SCHEDULED: "INSPECCIÓN PROGRAMADA",
    FIRST_INSPECTION_REJECTED: "OBSERVADO",
    SECOND_INSPECTION_SCHEDULED: "OBSERVADO · 2DA INSPECCIÓN PROGRAMADA",
    LICENSE_ISSUED: "LICENCIA EMITIDA",
    DEFINITIVELY_REJECTED: "RECHAZADO DEFINITIVO",
    RENEWAL_AVAILABLE: "RENOVACIÓN DISPONIBLE",
    EXPIRED: "VENCIDA",
  };

  return statuses[status] || status.replaceAll("_", " ");
}

function formatInspectionNumber(number: string) {
  if (number === "FIRST") return "Primera inspección";
  if (number === "SECOND") return "Segunda inspección";
  return number;
}

function formatInspectionStatus(status: string, result?: string | null) {
  if (status === "SCHEDULED") return "PROGRAMADA";
  if (status === "COMPLETED" && result === "APPROVED") return "APROBADA";
  if (status === "COMPLETED" && result === "REJECTED") return "RECHAZADA";
  return status;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function getApplication(applicationId: string) {
  return prisma.application.findUnique({
    where: {
      id: applicationId,
    },
    include: {
      business: true,
      documents: {
        select: {
          id: true,
          type: true,
        },
      },
      inspections: {
        orderBy: {
          scheduledAt: "asc",
        },
        include: {
          inspector: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      license: true,
    },
  });
}

async function ensureInspectionAssigned(applicationId: string) {
  const application = await prisma.application.findUnique({
    where: {
      id: applicationId,
    },
    include: {
      inspections: {
        select: {
          id: true,
          status: true,
          number: true,
        },
      },
    },
  });

  if (!application) return;

  const hasScheduledInspection = application.inspections.some(
    (inspection) => inspection.status === InspectionStatus.SCHEDULED
  );

  if (hasScheduledInspection) {
    if (application.status === ApplicationStatus.PAYMENT_COMPLETED) {
      await prisma.application.update({
        where: {
          id: application.id,
        },
        data: {
          status: ApplicationStatus.INSPECTION_SCHEDULED,
        },
      });
    }

    return;
  }

  if (application.status !== ApplicationStatus.PAYMENT_COMPLETED) {
    return;
  }

  const inspector = await prisma.user.findFirst({
    where: {
      role: Role.INSPECTOR,
      active: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!inspector) {
    return;
  }

  const now = await getCurrentSystemDate();
  const scheduledAt = new Date(now);
  scheduledAt.setDate(scheduledAt.getDate() + 1);
  scheduledAt.setHours(9, 0, 0, 0);

  await prisma.inspection.create({
    data: {
      applicationId: application.id,
      inspectorId: inspector.id,
      number: InspectionNumber.FIRST,
      status: InspectionStatus.SCHEDULED,
      scheduledAt,
    },
  });

  await prisma.application.update({
    where: {
      id: application.id,
    },
    data: {
      status: ApplicationStatus.INSPECTION_SCHEDULED,
    },
  });
}

export default async function PublicInspectionsPage({
  params,
}: {
  params: { applicationId: string };
}) {
  let application = await getApplication(params.applicationId);

  if (!application) {
    notFound();
  }

  if (
    application.status === ApplicationStatus.PAYMENT_COMPLETED &&
    application.inspections.length === 0
  ) {
    await ensureInspectionAssigned(application.id);
    redirect(`/tramite/${application.id}/inspecciones`);
  }

  if (
    application.status === ApplicationStatus.PAYMENT_COMPLETED &&
    application.inspections.length > 0
  ) {
    await ensureInspectionAssigned(application.id);
    redirect(`/tramite/${application.id}/inspecciones`);
  }

  const hasFloorPlan = application.documents.some(
    (document) => document.type === "FLOOR_PLAN"
  );

  const hasRucRecord = application.documents.some(
    (document) => document.type === "RUC_RECORD"
  );

  const documentsComplete = hasFloorPlan && hasRucRecord;

  const paymentCompleted =
    application.status === ApplicationStatus.PAYMENT_COMPLETED ||
    application.status === ApplicationStatus.INSPECTION_SCHEDULED ||
    application.status === ApplicationStatus.FIRST_INSPECTION_REJECTED ||
    application.status === ApplicationStatus.SECOND_INSPECTION_SCHEDULED ||
    application.status === ApplicationStatus.LICENSE_ISSUED ||
    application.status === ApplicationStatus.DEFINITIVELY_REJECTED;

  const currentInspection =
    application.inspections.find(
      (inspection) => inspection.status === InspectionStatus.SCHEDULED
    ) ||
    application.inspections[application.inspections.length - 1] ||
    null;

  const hasInspectorAssigned = Boolean(currentInspection?.inspector);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-amber-500 hover:text-amber-200"
          >
            <Home className="h-4 w-4" />
            Inicio
          </Link>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
            Trámite público
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.35em] text-amber-400">
              Control municipal
            </p>

            <h1 className="text-3xl font-bold text-white">
              Panel de inspección
            </h1>

            <p className="mt-2 max-w-3xl text-slate-400">
              Aquí se muestra el inspector asignado, la fecha programada y el
              resultado de la revisión municipal.
            </p>
          </div>

          <Link
            href={`/tramite/${application.id}/pago`}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-amber-500 hover:text-amber-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al pago
          </Link>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Trámite activo
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-white">
                    {application.number}
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    Estado actual:{" "}
                    <span className="font-bold text-amber-300">
                      {formatStatus(application.status)}
                    </span>
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm">
                  RUC:{" "}
                  <span className="font-bold text-white">
                    {application.business.ruc}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                  <div className="mb-3 flex items-center gap-3 text-amber-300">
                    <Building2 className="h-5 w-5" />

                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Razón social
                    </p>
                  </div>

                  <p className="font-bold text-white">
                    {application.business.legalName}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                  <div className="mb-3 flex items-center gap-3 text-amber-300">
                    <MapPin className="h-5 w-5" />

                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Domicilio fiscal
                    </p>
                  </div>

                  <p className="font-bold text-white">
                    {application.business.fiscalAddress}
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`rounded-3xl border p-6 ${
                hasInspectorAssigned
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-amber-500/30 bg-amber-500/10"
              }`}
            >
              <div className="flex items-start gap-3">
                {hasInspectorAssigned ? (
                  <UserCheck className="mt-1 h-7 w-7 shrink-0 text-emerald-300" />
                ) : (
                  <CalendarDays className="mt-1 h-7 w-7 shrink-0 text-amber-300" />
                )}

                <div className="w-full">
                  <div className="inline-flex rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-white">
                    {currentInspection
                      ? formatInspectionStatus(
                          currentInspection.status,
                          currentInspection.result
                        )
                      : "PENDIENTE"}
                  </div>

                  <h2 className="mt-4 text-2xl font-bold text-white">
                    {hasInspectorAssigned
                      ? "Inspección asignada"
                      : "Inspección pendiente de asignación"}
                  </h2>

                  {hasInspectorAssigned && currentInspection ? (
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-emerald-500/30 bg-slate-950/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                          Inspector asignado
                        </p>

                        <p className="mt-2 text-lg font-bold text-white">
                          {currentInspection.inspector.fullName}
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                          {currentInspection.inspector.email}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-emerald-500/30 bg-slate-950/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                          Fecha programada
                        </p>

                        <p className="mt-2 text-lg font-bold text-white">
                          {formatDateTime(currentInspection.scheduledAt)}
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                          {formatInspectionNumber(currentInspection.number)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      El pago ya fue registrado, pero todavía no existe una
                      inspección asignada. Verifica que exista un inspector
                      activo en el sistema.
                    </p>
                  )}

                  {currentInspection?.observations && (
                    <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Observaciones del inspector
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {currentInspection.observations}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex items-start gap-3">
                <ClipboardCheck className="mt-1 h-6 w-6 text-amber-300" />

                <div>
                  <h2 className="text-xl font-bold text-white">
                    Proceso de revisión
                  </h2>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <p className="font-bold text-white">
                        1. Inspector ingresa
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        El inspector verá esta inspección en su panel privado.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <p className="font-bold text-white">2. Revisa local</p>

                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Evalúa documentos y condiciones del establecimiento.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <p className="font-bold text-white">
                        3. Aprueba o rechaza
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Su decisión actualiza automáticamente el trámite.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {application.status === ApplicationStatus.LICENSE_ISSUED && (
              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6">
                <div className="flex items-start gap-3">
                  <BadgeCheck className="mt-1 h-7 w-7 text-emerald-300" />

                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Licencia lista
                    </h2>

                    <p className="mt-2 text-sm text-slate-300">
                      La inspección fue aprobada y la licencia ya fue emitida.
                    </p>

                    <Link
                      href={`/tramite/${application.id}/licencia`}
                      className="mt-5 inline-flex rounded-2xl bg-amber-500 px-6 py-3 font-bold text-slate-950 transition hover:bg-amber-400"
                    >
                      Ver licencia
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-400">
                Progreso
              </p>

              <h2 className="mt-3 text-2xl font-bold text-white">
                Estado del trámite
              </h2>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="font-bold text-emerald-300">1. RUC validado</p>

                  <p className="mt-1 text-sm text-slate-300">
                    El negocio pertenece al distrito de Trujillo.
                  </p>
                </div>

                <div
                  className={`rounded-2xl border p-4 ${
                    documentsComplete
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-amber-500/30 bg-amber-500/10"
                  }`}
                >
                  <p
                    className={`font-bold ${
                      documentsComplete ? "text-emerald-300" : "text-amber-300"
                    }`}
                  >
                    2. Documentos
                  </p>

                  <p className="mt-1 text-sm text-slate-300">
                    {documentsComplete
                      ? "Documentos completos."
                      : "Falta completar documentos."}
                  </p>
                </div>

                <div
                  className={`rounded-2xl border p-4 ${
                    paymentCompleted
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-slate-800 bg-slate-950/70"
                  }`}
                >
                  <p
                    className={`font-bold ${
                      paymentCompleted ? "text-emerald-300" : "text-slate-300"
                    }`}
                  >
                    3. Pago
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    {paymentCompleted
                      ? "Pago registrado correctamente."
                      : "Pago pendiente."}
                  </p>
                </div>

                <div
                  className={`rounded-2xl border p-4 ${
                    hasInspectorAssigned
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-amber-500/30 bg-amber-500/10"
                  }`}
                >
                  <p
                    className={`font-bold ${
                      hasInspectorAssigned
                        ? "text-emerald-300"
                        : "text-amber-300"
                    }`}
                  >
                    4. Inspección
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    {hasInspectorAssigned && currentInspection
                      ? `Asignada a ${currentInspection.inspector.fullName}`
                      : "Pendiente de asignación."}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-5 w-5 text-amber-300" />

                <div>
                  <h3 className="font-bold text-white">Panel del inspector</h3>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    El inspector asignado verá este trámite al iniciar sesión en
                    el panel de inspector. Desde ahí puede aprobar o rechazar la
                    inspección.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex items-start gap-3">
                <FileCheck2 className="mt-1 h-5 w-5 text-amber-300" />

                <div>
                  <h3 className="font-bold text-white">Siguiente etapa</h3>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Si el inspector aprueba, el sistema emite la licencia. Si
                    rechaza la primera inspección, se programa una segunda.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}