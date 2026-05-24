import { getCurrentUser } from "../../lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  Building2, 
  FileText, 
  DollarSign, 
  CalendarDays, 
  Award, 
  Plus,
  ArrowRight,
  ShieldCheck,
  AlertCircle
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

  // Simulación visual de estado de trámite (Fase mockup)
  const hasActiveApplication = false;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Bienvenida y Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-850">
        <div>
          <h1 className="text-2xl font-bold text-white">¡Hola, {user.fullName}!</h1>
          <p className="text-slate-400 text-sm mt-1">
            Desde este portal puedes gestionar tus licencias comerciales y programar inspecciones.
          </p>
        </div>
        {!hasActiveApplication && (
          <Link
            href="/solicitante/nuevo-tramite"
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition self-start cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Nueva Solicitud
          </Link>
        )}
      </div>

      {/* Grid de Estado Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/50 border border-slate-850 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estado de Solicitud</span>
            <span className="px-2.5 py-0.5 rounded text-[10px] bg-slate-950/60 border border-slate-800 text-slate-400 font-bold uppercase">
              Ninguna
            </span>
          </div>
          <p className="text-sm text-slate-300">No tienes trámites en curso en este momento.</p>
        </div>

        <div className="bg-slate-900/50 border border-slate-850 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inspecciones</span>
            <span className="px-2.5 py-0.5 rounded text-[10px] bg-slate-950/60 border border-slate-800 text-slate-400 font-bold uppercase">
              0 Pendientes
            </span>
          </div>
          <p className="text-sm text-slate-300">No hay inspecciones agendadas para tus locales.</p>
        </div>

        <div className="bg-slate-900/50 border border-slate-850 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Licencia Comercial</span>
            <span className="px-2.5 py-0.5 rounded text-[10px] bg-slate-950/60 border border-slate-800 text-slate-400 font-bold uppercase">
              Inactivo
            </span>
          </div>
          <p className="text-sm text-slate-300">Aún no cuentas con una licencia emitida.</p>
        </div>
      </div>

      {/* Flujo de Trámite Municipal */}
      <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-6 lg:p-8 space-y-6">
        <h2 className="text-lg font-bold text-white">Cronograma del Flujo de Trámite Municipal</h2>
        <div className="relative">
          {/* Línea conectora */}
          <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-slate-800 hidden md:block" />

          {/* Pasos */}
          <div className="space-y-8">
            {/* Paso 1 */}
            <div className="flex flex-col md:flex-row gap-6 relative">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-850 text-slate-400 flex items-center justify-center shrink-0 z-10">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-white text-base">Paso 1: Registrar Datos del Negocio</h3>
                <p className="text-sm text-slate-400">
                  Ingresa los datos fiscales (RUC de 11 dígitos, razón social, dirección comercial, actividad y representante legal).
                </p>
              </div>
            </div>

            {/* Paso 2 */}
            <div className="flex flex-col md:flex-row gap-6 relative">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-850 text-slate-400 flex items-center justify-center shrink-0 z-10">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-white text-base">Paso 2: Cargar Documentación Exigida</h3>
                <p className="text-sm text-slate-400">
                  Sube el croquis de distribución o plano del local, y tu ficha RUC actualizada en formatos PDF, JPG o PNG (máximo 5MB).
                </p>
              </div>
            </div>

            {/* Paso 3 */}
            <div className="flex flex-col md:flex-row gap-6 relative">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-850 text-slate-400 flex items-center justify-center shrink-0 z-10">
                <DollarSign className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-white text-base">Paso 3: Pago Simulado de Tasa</h3>
                <p className="text-sm text-slate-400">
                  Abona los S/ 2.00 requeridos simulando el depósito para habilitar la inspección técnica obligatoria.
                </p>
              </div>
            </div>

            {/* Paso 4 */}
            <div className="flex flex-col md:flex-row gap-6 relative">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-850 text-slate-400 flex items-center justify-center shrink-0 z-10">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-white text-base">Paso 4: Programación Automática de Inspección</h3>
                <p className="text-sm text-slate-400">
                  El sistema agendará de forma automática la inspección técnica más cercana de lunes a viernes en horario de 8:00 AM a 5:00 PM.
                </p>
              </div>
            </div>

            {/* Paso 5 */}
            <div className="flex flex-col md:flex-row gap-6 relative">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-850 text-slate-400 flex items-center justify-center shrink-0 z-10">
                <Award className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-white text-base">Paso 5: Aprobación y Descarga de Licencia</h3>
                <p className="text-sm text-slate-400">
                  Una vez que el inspector apruebe el local, el sistema generará automáticamente la licencia municipal firmada digitalmente en formato PDF para su descarga.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
