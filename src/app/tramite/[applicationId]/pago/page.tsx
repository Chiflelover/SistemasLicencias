import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import MercadoPagoCardBrick from "@/components/MercadoPagoCardBrick";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  ShieldCheck,
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

  const payerEmail = buildValidPayerEmail(application.business.ruc);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/40">
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
              Pago real con Visa / Mastercard
            </h1>

            <p className="mt-2 max-w-3xl text-slate-400">
              Realiza el pago del derecho de trámite. Mercado Pago procesa la
              tarjeta de forma segura y el sistema continuará con la
              programación de inspección cuando el pago sea aprobado.
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

                  <p className="text-3xl font-black text-amber-300">S/ 2.00</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-6 w-6 text-amber-300" />

                <div>
                  <h2 className="text-xl font-bold text-white">
                    Formulario seguro
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Los datos de la tarjeta son procesados por Mercado Pago. El
                    sistema municipal no almacena número de tarjeta ni CVV.
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

            {paymentCompleted && (
              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-emerald-200">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-6 w-6 shrink-0" />

                  <div>
                    <h2 className="text-xl font-bold">
                      Pago completado correctamente
                    </h2>

                    <p className="mt-2 text-sm leading-6">
                      El pago del trámite ya fue aprobado. Ahora puedes
                      continuar con la etapa de inspección.
                    </p>

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

            {documentsComplete && !paymentAllowed && !paymentCompleted && (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5 text-slate-300">
                Este trámite no se encuentra en estado pendiente de pago. Estado
                actual:{" "}
                <span className="font-bold text-amber-300">
                  {formatStatus(application.status)}
                </span>
              </div>
            )}

            {paymentAllowed ? (
              <div className="rounded-3xl border border-slate-800 bg-white p-6 text-slate-950">
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-slate-950">
                    Pago con Visa / Mastercard
                  </h2>

                  <p className="mt-2 text-sm text-slate-600">
                    Ingresa los datos de tu tarjeta. Mercado Pago procesará el
                    pago de forma segura por S/ 2.00.
                  </p>
                </div>

                <MercadoPagoCardBrick
                  applicationId={application.id}
                  payerEmail={payerEmail}
                />
              </div>
            ) : !paymentCompleted ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
                <div className="flex items-start gap-3">
                  <CreditCard className="mt-1 h-6 w-6 text-slate-500" />

                  <div>
                    <h2 className="text-xl font-bold text-slate-300">
                      Pago bloqueado
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      El formulario de tarjeta aparecerá cuando el trámite tenga
                      documentos completos y esté en estado PAGO PENDIENTE.
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
                      : "Falta subir plano del local y/o ficha RUC."}
                  </p>
                </div>

                <div
                  className={`rounded-2xl border p-4 ${
                    paymentCompleted
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : paymentAllowed
                      ? "border-amber-500/30 bg-amber-500/10"
                      : "border-slate-800 bg-slate-950/70"
                  }`}
                >
                  <p
                    className={`font-bold ${
                      paymentCompleted
                        ? "text-emerald-300"
                        : paymentAllowed
                        ? "text-amber-300"
                        : "text-slate-300"
                    }`}
                  >
                    3. Pago
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    {paymentCompleted
                      ? "Pago aprobado correctamente."
                      : paymentAllowed
                      ? "Formulario de pago habilitado."
                      : "Pendiente de habilitación."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="font-bold text-slate-300">4. Inspección</p>

                  <p className="mt-1 text-sm text-slate-400">
                    Se programará después del pago aprobado.
                  </p>
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