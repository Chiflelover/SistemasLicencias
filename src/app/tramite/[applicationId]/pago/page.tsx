import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import ManualPaymentForm from "@/components/ManualPaymentForm";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  ShieldCheck,
  User,
  WalletCards,
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

function canPay(status: string) {
  return status === "PENDING_PAYMENT" || status === "RENEWAL_AVAILABLE";
}

function buildValidPayerEmail(ruc: string) {
  const cleanRuc = ruc.replace(/\D/g, "");
  return `tramite${cleanRuc}@gmail.com`;
}

function canGoToInspection(status: string) {
  return (
    status === "PAYMENT_COMPLETED" ||
    status === "INSPECTION_SCHEDULED" ||
    status === "FIRST_INSPECTION_REJECTED" ||
    status === "SECOND_INSPECTION_SCHEDULED" ||
    status === "LICENSE_ISSUED" ||
    status === "DEFINITIVELY_REJECTED"
  );
}

export default async function PublicPaymentPage({
  params,
}: {
  params: { applicationId: string };
}) {
  // Enlace de cobro de Flow. Se lee en el servidor y en cada petición, así
  // cambiarlo no obliga a reconstruir la aplicación.
  const flowPaymentUrl = process.env.FLOW_PAYMENT_URL?.trim() || null;

  const application = await prisma.application.findUnique({
    where: {
      id: params.applicationId,
    },
    include: {
      business: true,
      documents: {
        select: {
          id: true,
          type: true,
          name: true,
          fileName: true,
        },
      },
      inspections: {
        orderBy: { scheduledAt: "asc" },
        include: {
          inspector: {
            select: { id: true, fullName: true, email: true },
          },
        },
      },
    },
  });

  if (!application) {
    notFound();
  }

  const hasFloorPlan = application.documents.some(
    (document) => document.type === "FLOOR_PLAN"
  );

  const hasRucRecord = application.documents.some(
    (document) => document.type === "RUC_RECORD"
  );

  const documentsComplete = hasFloorPlan && hasRucRecord;
  const paymentAllowed = documentsComplete && canPay(application.status);

  const paymentCompleted = application.status === "PAYMENT_COMPLETED";
  const inspectionScheduled = [
    "INSPECTION_SCHEDULED",
    "SECOND_INSPECTION_SCHEDULED",
    "LICENSE_ISSUED",
    "FIRST_INSPECTION_REJECTED",
    "DEFINITIVELY_REJECTED",
  ].includes(application.status);

  // Pick the most recent SCHEDULED inspection, or the latest overall
  const scheduledInspection =
    application.inspections.find((ins) => ins.status === "SCHEDULED") ||
    application.inspections[application.inspections.length - 1] ||
    null;

  const inspectionEnabled = canGoToInspection(application.status);
  const assignedInspection = application.inspections.find(
    (inspection) => inspection.status === "SCHEDULED"
  );
  const payerEmail = buildValidPayerEmail(application.business?.ruc ?? "0");

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/40">
        {/* El botón de Inicio lo aporta el GlobalHomeButton flotante, común a
            todo el flujo público; acá va solo el distintivo del trámite. */}
        <div className="mx-auto flex max-w-7xl items-center justify-end px-6 py-4">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
            Trámite público
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.35em] text-amber-400">
              Pago del trámite
            </p>

            <h1 className="text-3xl font-bold text-white">
              Pago del derecho de trámite
            </h1>

            <p className="mt-2 max-w-3xl text-slate-400">
              Registra el comprobante de tu pago para continuar al panel de
              inspección.
            </p>
          </div>

          {/* Retroceder a documentos solo tiene sentido antes de pagar. Una
              vez asentado el pago, la inspección ya está agendada y volver
              atrás confundiría: se muestra en su lugar el avance a inspección. */}
          {canPay(application.status) ? (
            <Link
              href={`/tramite/${application.id}/subir-documentos`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-amber-500 hover:text-amber-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a documentos
            </Link>
          ) : inspectionEnabled ? (
            <Link
              href={`/tramite/${application.id}/inspecciones`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-amber-500 hover:text-amber-200"
            >
              Ver inspección
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
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
                    <WalletCards className="h-5 w-5" />

                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Monto del trámite
                    </p>
                  </div>

                  <p className="text-3xl font-black text-amber-300">S/ 180.00</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-6 w-6 text-amber-300" />

                <div>
                  <h2 className="text-xl font-bold text-white">Pago seguro</h2>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    El sistema municipal no almacena números de tarjeta, CVV ni
                    claves del usuario. Solo se guarda el comprobante del pago.
                  </p>
                </div>
              </div>
            </div>

            {!documentsComplete && (
              <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200">
                Primero debes subir el plano del local y la ficha RUC antes de
                realizar el pago.
              </div>
            )}

            {inspectionEnabled && (
              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-emerald-200">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-6 w-6 shrink-0" />

                  <div>
                    <h2 className="text-xl font-bold">
                      Pago registrado correctamente
                    </h2>

                    <p className="mt-2 text-sm leading-6">
                      El pago del trámite ya fue registrado. Ahora puedes
                      continuar con la etapa de inspección.
                    </p>

                    {assignedInspection && (
                      <p className="mt-3 text-sm leading-6 text-emerald-100">
                        Inspector asignado:{" "}
                        <span className="font-bold">
                          {assignedInspection.inspector.fullName}
                        </span>
                      </p>
                    )}

                    <Link
                      href={`/tramite/${application.id}/inspecciones`}
                      className="mt-5 inline-flex rounded-2xl bg-amber-500 px-6 py-3 font-bold text-slate-950 transition hover:bg-amber-400"
                    >
                      Ver inspecciones
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {documentsComplete && !paymentAllowed && !inspectionEnabled && (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5 text-slate-300">
                Este trámite no se encuentra en estado pendiente de pago. Estado
                actual:{" "}
                <span className="font-bold text-amber-300">
                  {formatStatus(application.status)}
                </span>
              </div>
            )}

            {paymentAllowed ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
                {/* Va antes de todo: advertir que no hay devoluciones después
                    de pagar no le sirve a nadie. */}
                <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
                  <div className="shrink-0 rounded-xl border border-rose-500/20 bg-rose-500/10 p-2 text-rose-400">
                    <AlertCircle className="h-5 w-5" />
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Antes de pagar
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      El pago del derecho de trámite no tiene devolución bajo
                      ningún concepto. Revisa que los datos del negocio sean
                      correctos antes de continuar.
                    </p>
                  </div>
                </div>

                {/* El enlace de cobro se configura por variable de entorno: si
                    no está, el paso no se muestra y queda solo la carga del
                    comprobante, igual que antes. Mismo criterio que el correo
                    y el WhatsApp, que tampoco rompen si faltan sus claves. */}
                {flowPaymentUrl && (
                  <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
                      Paso 1 · Pagar
                    </p>

                    <h2 className="mt-2 text-lg font-bold text-white">
                      Paga en línea con Flow
                    </h2>

                    <p className="mt-2 text-sm text-slate-400">
                      Se abre en una pestaña nueva. Puedes pagar con tarjeta,
                      Yape o Plin. Al terminar, guarda la constancia y vuelve
                      aquí para subirla.
                    </p>

                    <a
                      href={flowPaymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 font-bold text-slate-950 transition hover:bg-amber-400"
                    >
                      <ExternalLink className="h-5 w-5" />
                      Pagar con Flow
                    </a>
                  </div>
                )}

                <div className="mb-5">
                  {flowPaymentUrl && (
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                      Paso 2 · Registrar
                    </p>
                  )}

                  <h2 className="mt-2 text-xl font-bold text-white">
                    Registrar el pago del derecho de trámite
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    Sube la imagen del comprobante de tu pago por{" "}
                    <strong className="text-amber-300">S/ 180.00</strong>. Al
                    registrarlo, el sistema agenda la inspección municipal.
                  </p>
                </div>

                <ManualPaymentForm applicationId={application.id} />
              </div>
            ) : !inspectionEnabled ? (

              <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
                <div className="flex items-start gap-3">
                  <CreditCard className="mt-1 h-6 w-6 text-slate-500" />

                  <div>
                    <h2 className="text-xl font-bold text-slate-300">
                      Pago bloqueado
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      El pago aparecerá cuando el trámite tenga documentos
                      completos y esté en estado PAGO PENDIENTE.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
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
                  className={`rounded-2xl border p-4 ${documentsComplete
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-amber-500/30 bg-amber-500/10"
                    }`}
                >
                  <p
                    className={`font-bold ${documentsComplete ? "text-emerald-300" : "text-amber-300"
                      }`}
                  >
                    2. Documentos
                  </p>

                  <p className="mt-1 text-sm text-slate-300">
                    {documentsComplete
                      ? "Documentos completos."
                      : "Falta subir plano del local y/o ficha RUC."}
                  </p>
                </div>

                <div
                  className={`rounded-2xl border p-4 ${paymentCompleted
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : paymentAllowed
                      ? "border-amber-500/30 bg-amber-500/10"
                      : "border-slate-800 bg-slate-950/70"
                    }`}
                >
                  <p
                    className={`font-bold ${paymentCompleted
                      ? "text-emerald-300"
                      : paymentAllowed
                        ? "text-amber-300"
                        : "text-slate-300"
                      }`}
                  >
                    3. Pago
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    {inspectionEnabled
                      ? "Pago registrado correctamente."
                      : paymentAllowed
                        ? "Formulario de pago habilitado."
                        : "Pendiente de habilitación."}
                  </p>
                </div>

                <div
                  className={`rounded-2xl border p-4 ${inspectionScheduled
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : paymentCompleted
                      ? "border-amber-500/30 bg-amber-500/10"
                      : "border-slate-800 bg-slate-950/70"
                    }`}
                >
                  <p
                    className={`font-bold ${inspectionScheduled
                      ? "text-emerald-300"
                      : paymentCompleted
                        ? "text-amber-300"
                        : "text-slate-300"
                      }`}
                  >
                    4. Inspección
                  </p>

                  {/* Antes del pago no se dice nada acá: el bloque de abajo ya
                      cubre ese caso. */}
                  {(assignedInspection || inspectionEnabled) && (
                    <p className="mt-1 text-sm text-slate-400">
                      {assignedInspection
                        ? `Asignada a ${assignedInspection.inspector.fullName}`
                        : "Pendiente de programación."}
                    </p>
                  )}

                  {scheduledInspection ? (
                    <div className="mt-3 space-y-2.5">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 shrink-0 text-amber-400" />
                        <div>
                          <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-500">Inspector asignado</span>
                          <span className="font-bold text-white">
                            {scheduledInspection.inspector.fullName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <CalendarDays className="h-4 w-4 shrink-0 text-amber-400" />
                        <div>
                          <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-500">Fecha y hora</span>
                          <span className="font-bold text-white">
                            {new Date(scheduledInspection.scheduledAt).toLocaleString("es-PE", {
                              weekday: "long",
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="mt-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                        <p className="text-[11px] font-semibold text-emerald-300">
                          ✓ Inspección agendada
                        </p>
                      </div>
                    </div>
                  ) : (
                    // El párrafo de arriba ya dice que se programa después del
                    // pago: repetirlo acá era el texto duplicado.
                    <p className="mt-1 text-sm text-slate-400">
                      {paymentCompleted
                        ? "Procesando agendamiento..."
                        : "Suerte con la inspección."}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex items-start gap-3">
                <FileText className="mt-1 h-5 w-5 text-amber-300" />

                <div>
                  <h3 className="font-bold text-white">Documentos</h3>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    El pago solo se habilita cuando el sistema detecta plano del
                    local y ficha RUC.
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