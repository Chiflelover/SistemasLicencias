"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  Plus,
  Power,
  Trash2,
  UserCog,
  X,
} from "lucide-react";

interface StaffRow {
  id: string;
  email: string;
  fullName: string;
  dni: string;
  phone: string;
  role: "INSPECTOR" | "CAJERO";
  active: boolean;
  createdAt: string;
  _count: {
    inspections: number;
    fines: number;
    registrations: number;
    cashPayments: number;
  };
}

interface Profile {
  id: string;
  email: string;
  fullName: string;
  dni: string;
  phone: string;
  role: string;
  active: boolean;
  createdAt: string;
  stats: Record<string, number>;
}

const FORM_INICIAL = {
  fullName: "",
  email: "",
  dni: "",
  phone: "",
  password: "",
  role: "INSPECTOR",
};

export default function AdminUsuariosPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [guardando, setGuardando] = useState(false);

  const [perfil, setPerfil] = useState<Profile | null>(null);
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [accionEnCurso, setAccionEnCurso] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);

    try {
      const response = await fetch("/api/admin/usuarios", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setStaff(data.staff || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const crear = async (event: React.FormEvent) => {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    setExito(null);

    try {
      const response = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setExito(`${form.role === "INSPECTOR" ? "Inspector" : "Cajero"} creado: ${form.email}`);
      setForm(FORM_INICIAL);
      setMostrarAlta(false);
      await cargar();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const verPerfil = async (id: string) => {
    setError(null);
    setNuevaPassword("");

    try {
      const response = await fetch(`/api/admin/usuarios/${id}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setPerfil(data.profile);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const cambiarPassword = async () => {
    if (!perfil) return;

    setAccionEnCurso(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/usuarios/${perfil.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: nuevaPassword }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setExito(`Contraseña actualizada para ${perfil.email}`);
      setNuevaPassword("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAccionEnCurso(false);
    }
  };

  const alternarActivo = async (row: StaffRow) => {
    setError(null);

    try {
      const response = await fetch(`/api/admin/usuarios/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !row.active }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setExito(data.message);
      await cargar();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const eliminar = async (row: StaffRow) => {
    if (!confirm(`¿Eliminar la cuenta de ${row.fullName}? Esta acción no se puede deshacer.`)) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/admin/usuarios/${row.id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setExito(`Cuenta de ${row.fullName} eliminada.`);
      if (perfil?.id === row.id) setPerfil(null);
      await cargar();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const inputClass =
    "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500";
  const labelClass =
    "block text-xs uppercase tracking-wider font-bold text-slate-500 mb-1.5";

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="text-sm text-slate-400 hover:text-white inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al panel
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-white">Personal del sistema</h1>
          <p className="mt-1 text-sm text-slate-400">
            Inspectores y cajeros. Los solicitantes no se gestionan desde acá.
          </p>
        </div>

        <button
          onClick={() => setMostrarAlta(!mostrarAlta)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
        >
          {mostrarAlta ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4 stroke-[3]" />}
          {mostrarAlta ? "Cancelar" : "Nuevo usuario"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {exito && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200 text-sm flex gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{exito}</span>
        </div>
      )}

      {mostrarAlta && (
        <form
          onSubmit={crear}
          className="rounded-2xl border border-slate-850 bg-slate-900/40 p-6 space-y-4"
        >
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Nuevo usuario
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Nombre completo</label>
              <input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
                minLength={3}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Correo</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>DNI</label>
              <input
                value={form.dni}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dni: e.target.value.replace(/\D/g, "").slice(0, 8),
                  })
                }
                required
                maxLength={8}
                inputMode="numeric"
                className={`${inputClass} font-mono`}
              />
            </div>

            <div>
              <label className={labelClass}>Teléfono</label>
              <input
                value={form.phone}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phone: e.target.value.replace(/\D/g, "").slice(0, 9),
                  })
                }
                required
                maxLength={9}
                placeholder="987654321"
                inputMode="tel"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Contraseña inicial</label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Rol</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className={inputClass}
              >
                <option value="INSPECTOR">Inspector</option>
                <option value="CAJERO">Cajero (caja)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 px-5 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
          >
            {guardando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 stroke-[3]" />
            )}
            Crear usuario
          </button>
        </form>
      )}

      <div className="rounded-2xl border border-slate-850 bg-slate-900/40 overflow-hidden">
        {cargando ? (
          <div className="p-10 text-center">
            <Loader2 className="w-5 h-5 mx-auto animate-spin text-slate-500" />
          </div>
        ) : staff.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">
            No hay personal registrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3 font-bold">Nombre</th>
                  <th className="text-left px-5 py-3 font-bold">Rol</th>
                  <th className="text-left px-5 py-3 font-bold">Correo</th>
                  <th className="text-left px-5 py-3 font-bold">Estado</th>
                  <th className="text-right px-5 py-3 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {staff.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-900/40">
                    <td className="px-5 py-3">
                      <p className="text-white font-semibold">{row.fullName}</p>
                      <p className="text-slate-500 text-xs font-mono">DNI {row.dni}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs font-bold ${
                          row.role === "INSPECTOR" ? "text-sky-400" : "text-amber-400"
                        }`}
                      >
                        {row.role === "INSPECTOR" ? "Inspector" : "Cajero"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400">{row.email}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs font-bold ${
                          row.active ? "text-emerald-400" : "text-slate-500"
                        }`}
                      >
                        {row.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => verPerfil(row.id)}
                          title="Ver perfil"
                          className="rounded-lg border border-slate-800 p-2 text-slate-400 transition hover:border-slate-600 hover:text-white"
                        >
                          <UserCog className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => alternarActivo(row)}
                          title={row.active ? "Desactivar" : "Activar"}
                          className="rounded-lg border border-slate-800 p-2 text-slate-400 transition hover:border-slate-600 hover:text-white"
                        >
                          <Power className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => eliminar(row)}
                          title="Eliminar"
                          className="rounded-lg border border-rose-500/30 p-2 text-rose-400 transition hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {perfil && (
        <div className="rounded-2xl border border-amber-500/30 bg-slate-900/60 p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">{perfil.fullName}</h2>
              <p className="text-sm text-slate-400">{perfil.email}</p>
            </div>
            <button
              onClick={() => setPerfil(null)}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className={labelClass}>DNI</p>
              <p className="text-white font-mono text-sm">{perfil.dni}</p>
            </div>
            <div>
              <p className={labelClass}>Teléfono</p>
              <p className="text-white text-sm">{perfil.phone}</p>
            </div>
            <div>
              <p className={labelClass}>Alta</p>
              <p className="text-white text-sm">
                {new Date(perfil.createdAt).toLocaleDateString("es-PE")}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {Object.entries(perfil.stats).map(([clave, valor]) => (
              <div
                key={clave}
                className="rounded-xl border border-slate-850 bg-slate-950/50 p-4"
              >
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  {clave}
                </p>
                <p className="mt-1 text-2xl font-black text-white">
                  {clave === "recaudado" ? `S/ ${Number(valor).toFixed(2)}` : valor}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-800 pt-5">
            <p className={labelClass}>Restablecer contraseña</p>
            <p className="text-xs text-slate-500 mb-3">
              Usá esto solo cuando el titular lo solicite. La contraseña anterior
              no se puede recuperar.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                placeholder="Nueva contraseña (mínimo 8 caracteres)"
                className={inputClass}
              />
              <button
                onClick={cambiarPassword}
                disabled={accionEnCurso || nuevaPassword.length < 8}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 px-5 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition whitespace-nowrap"
              >
                {accionEnCurso ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <KeyRound className="w-4 h-4" />
                )}
                Cambiar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
