import { getCurrentUser } from "../../lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  CalendarDays, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  FileSearch,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Search
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InspectorDashboard() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "INSPECTOR") {
    redirect("/login");
  }

  // Mock de lista de inspecciones para diseño visual (Fase mockup)
  const mockInspections = [
    {
      id: "insp_1",
      appNumber: "MPT-2026-0089",
      businessName: "Inversiones Trujillo S.A.C.",
      ruc: "20123456789",
      date: "25/05/2026",
      time: "09:00 AM",
      type: "Primera Inspección",
      status: "SCHEDULED" // SCHEDULED, COMPLETED
    },
    {
      id: "insp_2",
      appNumber: "MPT-2026-0094",
      businessName: "Minimarket La Primavera",
      ruc: "10987654321",
      date: "26/05/2026",
      time: "11:00 AM",
      type: "Segunda Inspección",
      status: "SCHEDULED"
    }
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Bienvenida e Info General */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-850">
        <div>
          <h1 className="text-2xl font-bold text-white">¡Buenas tardes, {user.fullName}!</h1>
          <p className="text-slate-400 text-sm mt-1">
            Estas son las inspecciones programadas que tienes asignadas bajo tu jurisdicción.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-2 rounded-xl text-xs font-bold self-start">
          <ShieldCheck className="w-4 h-4" />
          Rango de Auditoría: Trujillo Metropolitano
        </div>
      </div>

      {/* Grid de Métricas del Inspector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900/50 border border-slate-850 p-6 rounded-2xl space-y-4">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Asignadas</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">2</span>
            <span className="text-xs text-slate-400 font-semibold">programadas</span>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-850 p-6 rounded-2xl space-y-4">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Aprobadas</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400">12</span>
            <span className="text-xs text-slate-500 font-semibold">este mes</span>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-850 p-6 rounded-2xl space-y-4">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Rechazadas</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-red-400">3</span>
            <span className="text-xs text-slate-500 font-semibold">con observaciones</span>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-850 p-6 rounded-2xl space-y-4">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Multas Registradas</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-400">S/ 4,500</span>
            <span className="text-xs text-slate-500 font-semibold">inopinadas</span>
          </div>
        </div>
      </div>

      {/* Tabla de Bandeja de Inspecciones */}
      <div className="bg-slate-900/30 border border-slate-850 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-850 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Bandeja de Inspecciones Asignadas</h2>
            <p className="text-xs text-slate-500 mt-0.5">Evalúa los establecimientos programados por el sistema.</p>
          </div>

          {/* Buscador de Mockup */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por RUC o Razón..."
              className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
              disabled
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-850 bg-slate-950/20 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="p-4 pl-6">Nº Trámite</th>
                <th className="p-4">Razón Social / RUC</th>
                <th className="p-4">Fecha y Hora</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Estado</th>
                <th className="p-4 pr-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/80 text-sm text-slate-300">
              {mockInspections.map((insp) => (
                <tr key={insp.id} className="hover:bg-slate-900/20 transition">
                  <td className="p-4 pl-6 font-semibold text-white">{insp.appNumber}</td>
                  <td className="p-4">
                    <div className="font-semibold text-slate-200">{insp.businessName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{insp.ruc}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-slate-500" />
                      <div>
                        <span>{insp.date}</span>
                        <span className="text-slate-500 text-xs ml-2 font-medium">{insp.time}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-xs font-medium text-slate-400">{insp.type}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold uppercase">
                      Programado
                    </span>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <button
                      className="bg-slate-800 hover:bg-slate-700 text-white hover:text-amber-400 px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                      disabled
                    >
                      Evaluar Local
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
