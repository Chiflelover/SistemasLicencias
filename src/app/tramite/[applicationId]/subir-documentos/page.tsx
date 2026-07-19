import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import PublicDocumentUploadForm from "@/components/PublicDocumentUploadForm";
import { canUploadDocuments, isUnderObservation } from "@/lib/documents";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
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

export default async function PublicUploadDocumentsPage({
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
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
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

  const cargaHabilitada = canUploadDocuments(application.status);
  const enSubsanacion = isUnderObservation(application.status);

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
              Gestión documental
            </p>

            <h1 className="text-3xl font-bold text-white">
              Subir documentos para tu trámite
            </h1>

            <p className="mt-2 max-w-3xl text-slate-400">
              Adjunta el plano del local y la ficha RUC para continuar con el
              pago del derecho de trámite.
            </p>
          </div>

          <Link
            href="/iniciar-tramite"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-amber-500 hover:text-amber-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Nuevo RUC
          </Link>
        </div>

        {enSubsanacion && (
          <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
              Trámite observado
            </p>
            <h2 className="mt-2 text-xl font-bold text-white">
              La carga de documentos fue habilitada nuevamente
            </h2>
            <p className="mt-2 text-sm text-amber-100/80">
              El inspector registró observaciones en la primera inspección.
              Podés volver a adjuntar el plano del local y los certificados
              antes de la segunda inspección, que ya está programada.
            </p>
          </div>
        )}

        {!cargaHabilitada && (
          <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
              Carga cerrada
            </p>
            <h2 className="mt-2 text-xl font-bold text-white">
              Este trámite ya no admite documentos
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Estado actual: {formatStatus(application.status)}. La carga solo
              está habilitada mientras se arma el expediente o durante una
              subsanación por observación.
            </p>
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
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
                    <Building2 className="h-5 w-5" />

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

            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex items-center gap-3 text-amber-300">
                <FileText className="h-6 w-6" />

                <h2 className="text-xl font-bold text-white">
                  Documentos requeridos
                </h2>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div
                  className={`rounded-2xl border p-5 ${
                    hasFloorPlan
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-slate-800 bg-slate-950/70"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Requisito 1
                  </p>

                  <h3 className="mt-2 font-bold text-white">
                    Plano del local
                  </h3>

                  <p className="mt-2 text-sm text-slate-400">
                    Archivo PDF, JPG o PNG del plano del establecimiento.
                  </p>

                  {hasFloorPlan && (
                    <p className="mt-4 flex items-center gap-2 text-sm font-bold text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      Documento subido
                    </p>
                  )}
                </div>

                <div
                  className={`rounded-2xl border p-5 ${
                    hasRucRecord
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-slate-800 bg-slate-950/70"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Requisito 2
                  </p>

                  <h3 className="mt-2 font-bold text-white">Ficha RUC</h3>

                  <p className="mt-2 text-sm text-slate-400">
                    Constancia o ficha RUC del negocio validado.
                  </p>

                  {hasRucRecord && (
                    <p className="mt-4 flex items-center gap-2 text-sm font-bold text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      Documento subido
                    </p>
                  )}
                </div>
              </div>
            </div>

            <PublicDocumentUploadForm applicationId={application.id} />
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
                  <p className="font-bold text-emerald-300">
                    1. RUC validado
                  </p>

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

                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="font-bold text-slate-300">3. Pago</p>

                  <p className="mt-1 text-sm text-slate-400">
                    Se habilitará cuando los documentos estén completos.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="font-bold text-slate-300">4. Inspección</p>

                  <p className="mt-1 text-sm text-slate-400">
                    Se programará después del pago.
                  </p>
                </div>
              </div>

              {documentsComplete ? (
                <Link
                  href={`/tramite/${application.id}/pago`}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 font-bold text-slate-950 hover:bg-amber-400"
                >
                  <WalletCards className="h-5 w-5" />
                  Continuar al pago
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="mt-6 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-slate-800 px-6 py-3 font-bold text-slate-500"
                >
                  <WalletCards className="h-5 w-5" />
                  Pago bloqueado
                </button>
              )}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <h3 className="font-bold text-white">Importante</h3>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Guarda esta URL del trámite para continuar luego. El flujo ya no
                depende de una cuenta visible de solicitante.
              </p>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}