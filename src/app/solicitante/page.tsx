import { getCurrentUser } from "../../lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ApplicationRepository } from "@/repositories/application.repository";
import {
  Building2,
  FileText,
  DollarSign,
  CalendarDays,
  Award,
  Plus,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SolicitanteDashboard() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "APPLICANT") {
    redirect("/login");
  }

  const application = await ApplicationRepository.findByApplicantId(user.id);
  const hasActiveApplication = Boolean(application);
  const license = application?.license;

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-850">
        <div>
          <h1 className="text-2xl font-bold text-white">¡Hola, {user.fullName}!</h1>
          <p className="text-slate-400 text-sm mt-1">
            Administra tu trámite, sube documentos, paga y revisa el estado de tu licencia.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {!hasActiveApplication ? (
            <Link
              href="/solicitante/nuevo-tramite"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Nueva Solicitud
            </Link>
          ) : (
            <Link
              href="/solicitante/inspecciones"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-amber-500 hover:text-amber-200 transition"
            >
              <ArrowRight className="w-4 h-4" />
              Ver mi trámite
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="space-y-6 rounded-3xl border border-slate-850 bg-slate-900/40 p-6 lg:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Resumen del trámite</p>
              <h2 className="text-2xl font-bold text-white">Tu estado actual</h2>
            </div>
            <div className="rounded-2xl border border-slate-850 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
              {application?.status?.replaceAll("_", " ") ?? "SIN TRÁMITE"}
            </div>
          </div>

          {hasActiveApplication ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-850 bg-slate-950/30 p-5">
                <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Trámite</p>
                <p className="mt-3 text-xl font-semibold text-white">{application?.number}</p>
              </div>
              <div className="rounded-3xl border border-slate-850 bg-slate-950/30 p-5">
                <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Inspecciones</p>
                <p className="mt-3 text-xl font-semibold text-white">{application?.inspections.length}</p>
              </div>
              <div className="rounded-3xl border border-slate-850 bg-slate-950/30 p-5">
                <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Licencia</p>
                <p className="mt-3 text-xl font-semibold text-white">
                  {license ? license.status.replaceAll("_", " ") : "No emitida"}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-850 bg-slate-950/30 p-6 text-slate-300">
              <div className="flex items-center gap-3 text-amber-300 mb-3">
                <AlertTriangle className="w-5 h-5" />
                <p className="font-semibold">Aún no tienes un trámite iniciado</p>
              </div>
              <p>Registra tu negocio para comenzar el flujo de licencia municipal.</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/solicitante/nuevo-tramite"
              className="rounded-3xl border border-slate-850 bg-slate-950/40 p-5 text-left transition hover:border-amber-500"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">1. Registrar negocio</p>
              <p className="mt-3 text-sm text-slate-300">Comienza el trámite con tus datos fiscales.</p>
            </Link>
            <Link
              href="/solicitante/subir-documentos"
              className="rounded-3xl border border-slate-850 bg-slate-950/40 p-5 text-left transition hover:border-amber-500"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">2. Subir documentos</p>
              <p className="mt-3 text-sm text-slate-300">Adjunta el plano y la ficha RUC.</p>
            </Link>
            <Link
              href="/solicitante/pago"
              className="rounded-3xl border border-slate-850 bg-slate-950/40 p-5 text-left transition hover:border-amber-500"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">3. Pago simulado</p>
              <p className="mt-3 text-sm text-slate-300">Realiza el pago para activar la inspección.</p>
            </Link>
            <Link
              href="/solicitante/licencia"
              className="rounded-3xl border border-slate-850 bg-slate-950/40 p-5 text-left transition hover:border-amber-500"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">4. Licencia</p>
              <p className="mt-3 text-sm text-slate-300">Revisa tu licencia y descárgala cuando esté lista.</p>
            </Link>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-850 bg-slate-900/40 p-6">
            <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Acciones sugeridas</p>
            <div className="mt-4 space-y-4 text-slate-300 text-sm">
              <div className="rounded-2xl border border-slate-850 bg-slate-950/30 p-4">
                <p className="font-semibold text-white">Carga documentos</p>
                <p className="mt-2">Sube el plano y la ficha RUC para mover el trámite a pago.</p>
              </div>
              <div className="rounded-2xl border border-slate-850 bg-slate-950/30 p-4">
                <p className="font-semibold text-white">Paga la tasa</p>
                <p className="mt-2">El pago simulado es necesario para que se programe la inspección.</p>
              </div>
              {license && (
                <div className="rounded-2xl border border-slate-850 bg-slate-950/30 p-4">
                  <p className="font-semibold text-white">Tu licencia está lista</p>
                  <p className="mt-2">Descarga el PDF desde la sección de licencias.</p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
