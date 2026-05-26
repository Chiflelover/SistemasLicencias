import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSystemDate } from "@/lib/date";
import PayButton from "@/components/PayButton";
import { AlertTriangle, CheckCircle2, Clock3, CreditCard } from "lucide-react";
import { ApplicationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const applicationInclude = {
  business: true,
  documents: true,
  payments: true,
  inspections: {
    orderBy: {
      createdAt: "asc" as const,
    },
    include: {
      inspector: {
        select: {
          fullName: true,
        },
      },
    },
  },
  license: true,
};

function formatStatus(status?: string | null) {
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

function normalizeDocumentType(type: unknown) {
  return String(type ?? "")
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_");
}

function hasFloorPlanDocument(documents: Array<{ type: unknown }>) {
  return documents.some((document) => {
    const type = normalizeDocumentType(document.type);

    return (
      type === "FLOOR_PLAN" ||
      type.includes("FLOOR") ||
      type.includes("PLANO") ||
      type.includes("PLAN")
    );
  });
}

function hasRucRecordDocument(documents: Array<{ type: unknown }>) {
  return documents.some((document) => {
    const type = normalizeDocumentType(document.type);

    return (
      type === "RUC_RECORD" ||
      type.includes("RUC")
    );
  });
}

export default async function PagoPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "APPLICANT") {
    redirect("/login");
  }

  const applications = await prisma.application.findMany({
    where: {
      applicantId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: applicationInclude,
  });

  let application =
    applications.find(
      (app) =>
        app.status === ApplicationStatus.PENDING_PAYMENT ||
        app.status === ApplicationStatus.RENEWAL_AVAILABLE
    ) ??
    applications.find((app) => {
      const hasFloorPlan = hasFloorPlanDocument(app.documents);
      const hasRucRecord = hasRucRecordDocument(app.documents);

      return (
        app.status === ApplicationStatus.DRAFT &&
        hasFloorPlan &&
        hasRucRecord
      );
    }) ??
    applications[0] ??
    null;

  let uploadedDocuments = application?.documents ?? [];

  let hasFloorPlan = hasFloorPlanDocument(uploadedDocuments);
  let hasRucRecord = hasRucRecordDocument(uploadedDocuments);

  let missingDocuments = [
    !hasFloorPlan && "Plano del local",
    !hasRucRecord && "Registro RUC",
  ].filter(Boolean) as string[];

  if (
    application &&
    application.status === ApplicationStatus.DRAFT &&
    missingDocuments.length === 0
  ) {
    application = await prisma.application.update({
      where: {
        id: application.id,
      },
      data: {
        status: ApplicationStatus.PENDING_PAYMENT,
        updatedAt: await getCurrentSystemDate(),
      },
      include: applicationInclude,
    });

    uploadedDocuments = application.documents;
    hasFloorPlan = hasFloorPlanDocument(uploadedDocuments);
    hasRucRecord = hasRucRecordDocument(uploadedDocuments);

    missingDocuments = [
      !hasFloorPlan && "Plano del local",
      !hasRucRecord && "Registro RUC",
    ].filter(Boolean) as string[];
  }

  const mercadoPagoLink =
    process.env.NEXT_PUBLIC_MERCADOPAGO_PAYMENT_LINK ||
    "https://mpago.la/1qGsg5R";

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/40 p-6 rounded-3xl border border-slate-850">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-amber-400 font-semibold mb-2">
            Pago del trámite
          </p>

          <h1 className="text-3xl font-bold text-white">
            Pago real del derecho de trámite
          </h1>

          <p className="mt-2 text-slate-400 max-w-2xl">
            Realiza el pago de S/ 2.00 con Visa o Mastercard desde el
            formulario seguro de Mercado Pago integrado en la web. Cuando el
            pago sea aprobado, el sistema programará automáticamente la
            inspección municipal.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-300">
          <CreditCard className="w-5 h-5" />
          <span className="text-sm font-semibold">Pago seguro</span>
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
                Debes iniciar un trámite de negocio antes de poder realizar el
                pago.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-850 bg-slate-950/80 p-5 text-slate-200">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
                      Trámite activo
                    </p>

                    <p className="text-xl font-semibold text-white">
                      {application.number}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-900/80 px-4 py-3 text-sm text-slate-300 border border-slate-850">
                    Estado:{" "}
                    <span className="font-semibold text-amber-300">
                      {formatStatus(application.status)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-850 bg-slate-950/60 p-5">
                  <div className="flex items-center gap-3 text-amber-300 mb-3">
                    <Clock3 className="w-4 h-4" />
                    <span className="font-semibold text-sm">
                      Fecha de creación
                    </span>
                  </div>

                  <p className="text-sm text-slate-400">
                    {new Date(application.createdAt).toLocaleDateString(
                      "es-PE"
                    )}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-850 bg-slate-950/60 p-5">
                  <div className="flex items-center gap-3 text-amber-300 mb-3">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-semibold text-sm">
                      Pago requerido
                    </span>
                  </div>

                  <p className="text-sm text-slate-400">S/ 2.00</p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-850 bg-slate-900/80 p-5 text-slate-300">
                <p className="text-sm">
                  Para continuar, primero debes completar los documentos
                  obligatorios. Luego aparecerá el formulario de tarjeta para
                  realizar el pago real.
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
                  <p className="mt-3 text-sm text-emerald-300">
                    Documentos completos. El trámite está listo para realizar el
                    pago real con tarjeta.
                  </p>
                )}

                <p className="text-sm mt-3 text-slate-400">
                  El sistema no guarda número de tarjeta ni CVV. Mercado Pago
                  procesa el pago y devuelve la respuesta de aprobación.
                </p>
              </div>
            </div>
          )}
        </section>

        <PayButton
          applicationId={application?.id ?? null}
          applicationStatus={application?.status ?? null}
          mercadoPagoLink={mercadoPagoLink}
          missingDocuments={missingDocuments}
          payerEmail={user.email}
        />
      </div>
    </div>
  );
}