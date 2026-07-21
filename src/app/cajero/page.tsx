import Link from "next/link";
import { getCurrentUser } from "../../lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import {
  Building2,
  DollarSign,
  Plus,
  FileText,
  CheckCircle2,
  Wallet,
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

export default async function CajeroDashboard() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "CAJERO") {
    redirect("/login");
  }

  // Solo los trámites registrados por este cajero.
  const applications = await prisma.application.findMany({
    where: { registeredById: user.id },
    include: {
      business: true,
      payments: { select: { id: true, amount: true, operationNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // El cobro exige turno abierto. Se consulta para avisarlo desde el panel y
  // que no lo descubra recién al confirmar un pago.
  const cajaAbierta = await prisma.cashSession.findFirst({
    where: { cashierId: user.id, status: "OPEN" },
    select: { id: true },
  });

  const totalRegistradas = applications.length;
  const totalCobradas = applications.filter((a) => a.payments.length > 0).length;
  const pendientesDePago = applications.filter(
    (a) => a.status === "PENDING_PAYMENT"
  ).length;

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-850">
        <div>
          <h1 className="text-2xl font-bold text-white">
            ¡Hola, {user.fullName}!
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Registra solicitudes y pagos presenciales, y consulta lo que
            atendiste en ventanilla.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/cajero/registro-presencial"
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Registro Presencial
          </Link>

          <Link
            href="/cajero/pago"
            className="border border-slate-700 hover:border-slate-500 text-slate-200 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
          >
            <DollarSign className="w-4 h-4" />
            Registrar Pago
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-850 bg-slate-900/40 p-5">
          <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider font-bold">
            <FileText className="w-4 h-4" />
            Registradas
          </div>
          <p className="mt-2 text-3xl font-black text-white">{totalRegistradas}</p>
        </div>

        <div className="rounded-2xl border border-slate-850 bg-slate-900/40 p-5">
          <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider font-bold">
            <CheckCircle2 className="w-4 h-4" />
            Cobradas
          </div>
          <p className="mt-2 text-3xl font-black text-emerald-400">{totalCobradas}</p>
        </div>

        <div className="rounded-2xl border border-slate-850 bg-slate-900/40 p-5">
          <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider font-bold">
            <DollarSign className="w-4 h-4" />
            Pago pendiente
          </div>
          <p className="mt-2 text-3xl font-black text-amber-400">{pendientesDePago}</p>
        </div>
      </div>

      {!cajaAbierta && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 flex items-start gap-3">
          <Wallet className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />

          <div className="text-sm">
            <p className="font-bold text-white">La caja está cerrada</p>

            <p className="mt-1 text-amber-200">
              Mientras siga así no vas a poder registrar cobros.{" "}
              <Link
                href="/cajero/arqueo"
                className="font-bold underline underline-offset-2 hover:text-amber-100"
              >
                Abrila desde Arqueo de caja
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-850 bg-slate-900/40 overflow-hidden">
        <div className="p-5 border-b border-slate-850">
          <h2 className="text-lg font-bold text-white">
            Solicitudes que registré
          </h2>
        </div>

        {applications.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            <Building2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
            Todavía no registraste ninguna solicitud presencial.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3 font-bold">Trámite</th>
                  <th className="text-left px-5 py-3 font-bold">Negocio</th>
                  <th className="text-left px-5 py-3 font-bold">RUC</th>
                  <th className="text-left px-5 py-3 font-bold">Estado</th>
                  <th className="text-left px-5 py-3 font-bold">Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {applications.map((application) => (
                  <tr key={application.id} className="hover:bg-slate-900/40">
                    <td className="px-5 py-3 font-mono text-amber-300">
                      {application.number}
                    </td>
                    <td className="px-5 py-3 text-slate-200">
                      {application.business.legalName}
                    </td>
                    <td className="px-5 py-3 text-slate-400 font-mono">
                      {application.business.ruc}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-bold text-slate-300">
                        {formatStatus(application.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400">
                      {application.payments.length > 0
                        ? application.payments[0].operationNumber
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
