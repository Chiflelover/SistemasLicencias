import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import PaymentTabs from "@/components/PaymentTabs";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  Home,
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
    FIRST_INSPECTION_REJECTED: "PRIMERA INSPECCIÓN RECHAZADA",
    SECOND_INSPECTION_SCHEDULED: "SEGUNDA INSPECCIÓN PROGRAMADA",
    LICENSE_ISSUED: "LICENCIA EMITIDA",
    DEFINITIVELY_REJECTED: "RECHAZADA DEFINITIVAMENTE",
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
  const mercadoPagoLink = process.env.NEXT_PUBLIC_MERCADOPAGO_PAYMENT_LINK || "";
  const assignedInspection = application.inspections.find(
    (inspection) => inspection.status === "SCHEDULED"
  );
  const payerEmail = buildValidPayerEmail(application.business?.ruc ?? "0");

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
              Pago del trámite
            </p>

            <h1 className="text-3xl font-bold text-white">
              Pago real con Mercado Pago
            </h1>

            <p className="mt-2 max-w-3xl text-slate-400">
              Primero realiza el pago en Mercado Pago. Después vuelve a esta
              pantalla y confirma el pago para continuar al panel de inspección.
            </p>
          </div>

          <Link
            href={`/tramite/${application.id}/subir-documentos`}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-amber-500 hover:text-amber-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a documentos
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
                    Los datos de tarjeta, Yape o cuenta se ingresan directamente
                    en Mercado Pago. El sistema municipal no almacena número de
                    tarjeta, CVV ni claves del usuario.
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

              <PaymentTabs
                applicationId={application.id}
                payerEmail={payerEmail}
              />
            ) : !paymentCompleted ? (

              <div className="rounded-3xl border border-slate-800 bg-white p-6 text-slate-950">
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-slate-950">
                    Pagar derecho de trámite
                  </h2>

                  <p className="mt-2 text-sm text-slate-600">
                    Serás redirigido a Mercado Pago para realizar el pago real
                    del trámite por S/ 180.00.
                  </p>
                </div>

                {mercadoPagoLink ? (
                  <a
                    href={mercadoPagoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-4 font-bold text-slate-950 transition hover:bg-amber-400"
                  >
                    <ExternalLink className="h-5 w-5" />
                    Pagar con Mercado Pago
                  </a>
                ) : (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700">
                    Falta configurar NEXT_PUBLIC_MERCADOPAGO_PAYMENT_LINK en el
                    archivo .env.
                  </div>
                )}

                <form
                  action={`/api/public/tramite/${application.id}/pago/confirmar`}
                  method="POST"
                  className="mt-4"
                >
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-4 font-bold text-emerald-700 transition hover:bg-emerald-500/20"
                  >
                    Ya realicé el pago, continuar a inspección
                  </button>
                </form>

                <p className="mt-4 text-xs leading-5 text-slate-500">
                  Para la demostración académica, después de pagar en Mercado
                  Pago se confirma el pago y el trámite continúa a inspección.
                  En producción real, esta confirmación se reemplaza por un
                  webhook automático de Mercado Pago.
                </p>
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

                  <p className="mt-1 text-sm text-slate-400">
                    {assignedInspection
                      ? `Asignada a ${assignedInspection.inspector.fullName}`
                      : inspectionEnabled
                      ? "Pendiente de programación."
                      : "Se programará después del pago aprobado."}

                  </p>

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
                    <p className="mt-1 text-sm text-slate-400">
                      {paymentCompleted
                        ? "Procesando agendamiento..."
                        : "Se programará después del pago aprobado."}
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