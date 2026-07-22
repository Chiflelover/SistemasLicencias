import Link from "next/link";
import { getCurrentUser } from "../../lib/auth";
import { redirect } from "next/navigation";
import { AdminService } from "@/services/admin.service";
import TarifaTramite from "@/components/TarifaTramite";
import ValorUit from "@/components/ValorUit";
import { Users, DollarSign, ShieldCheck, Wallet, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/login");
  }

  const [staff, recaudacion] = await Promise.all([
    AdminService.listStaff(),
    AdminService.getRevenueByCashRegister(),
  ]);

  const inspectores = staff.filter((s) => s.role === "INSPECTOR");
  const cajeros = staff.filter((s) => s.role === "CAJERO");
  const inactivos = staff.filter((s) => !s.active).length;

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-850">
        <h1 className="text-2xl font-bold text-white">
          ¡Hola, {user.fullName}!
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Gestiona el personal del sistema y controla la recaudación de cada
          caja.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-850 bg-slate-900/40 p-5">
          <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider font-bold">
            <ShieldCheck className="w-4 h-4" />
            Inspectores
          </div>
          <p className="mt-2 text-3xl font-black text-white">
            {inspectores.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-850 bg-slate-900/40 p-5">
          <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider font-bold">
            <Wallet className="w-4 h-4" />
            Cajas
          </div>
          <p className="mt-2 text-3xl font-black text-white">{cajeros.length}</p>
        </div>

        <div className="rounded-2xl border border-slate-850 bg-slate-900/40 p-5">
          <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider font-bold">
            <Users className="w-4 h-4" />
            Cuentas inactivas
          </div>
          <p className="mt-2 text-3xl font-black text-slate-400">{inactivos}</p>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2 text-amber-400 text-xs uppercase tracking-wider font-bold">
            <DollarSign className="w-4 h-4" />
            Recaudado
          </div>
          <p className="mt-2 text-3xl font-black text-white">
            S/ {recaudacion.totalGeneral.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Link
          href="/admin/usuarios"
          className="group rounded-2xl border border-slate-850 bg-slate-900/40 p-6 transition hover:border-amber-500/40"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Gestionar personal</h2>
            <ArrowRight className="w-5 h-5 text-slate-600 transition group-hover:text-amber-400" />
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Dar de alta cajas, ver los perfiles del personal, restablecer
            contraseñas y dar de baja cuentas.
          </p>
        </Link>

        <Link
          href="/admin/cajas"
          className="group rounded-2xl border border-slate-850 bg-slate-900/40 p-6 transition hover:border-amber-500/40"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              Recaudación por caja
            </h2>
            <ArrowRight className="w-5 h-5 text-slate-600 transition group-hover:text-amber-400" />
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Cuánto generó cada ventanilla, con desglose por método de pago y
            filtro por período.
          </p>
        </Link>

        <Link
          href="/admin/inspecciones"
          className="group rounded-2xl border border-slate-850 bg-slate-900/40 p-6 transition hover:border-amber-500/40"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Inspecciones</h2>
            <ArrowRight className="w-5 h-5 text-slate-600 transition group-hover:text-amber-400" />
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Todas las inspecciones —pasadas, de hoy y futuras— con su resultado
            y las observaciones del inspector.
          </p>
        </Link>
      </div>

      <TarifaTramite />
      <ValorUit />
    </div>
  );
}
