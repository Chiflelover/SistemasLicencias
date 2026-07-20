"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Wallet,
} from "lucide-react";

type Sesion = {
  id: string;
  cajero: string;
  email: string;
  openedAt: string;
  closedAt: string | null;
  status: "OPEN" | "PENDING_APPROVAL" | "CLOSED";
  fondo: number;
  efectivo: number | null;
  digital: number | null;
  esperado: number | null;
  contado: number | null;
  diferencia: number | null;
  justificacion: string | null;
  autorizadoPor: string | null;
};

const soles = (monto: number | null) =>
  monto === null
    ? "—"
    : `S/ ${monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

const ESTADOS: Record<Sesion["status"], string> = {
  OPEN: "Abierta",
  PENDING_APPROVAL: "Esperando autorización",
  CLOSED: "Cerrada",
};

export default function SesionesCaja() {
  const [pendientes, setPendientes] = useState<Sesion[]>([]);
  const [historial, setHistorial] = useState<Sesion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [autorizando, setAutorizando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/cajas/sesiones", {
        cache: "no-store",
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error);

      setPendientes(json.pendientes);
      setHistorial(json.historial);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const autorizar = async (sessionId: string) => {
    setAutorizando(sessionId);
    setError(null);

    try {
      const response = await fetch("/api/admin/cajas/sesiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error);

      await cargar();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAutorizando(null);
    }
  };

  if (cargando) {
    return (
      <div className="rounded-2xl border border-slate-850 bg-slate-900/40 p-8 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Solicitudes de cierre descuadrado */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
        <div className="p-5 border-b border-amber-500/20 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <h2 className="text-lg font-bold text-white">
            Cierres esperando autorización
          </h2>
        </div>

        {pendientes.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
            No hay solicitudes pendientes.
          </div>
        ) : (
          <div className="divide-y divide-slate-850">
            {pendientes.map((sesion) => (
              <div key={sesion.id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{sesion.cajero}</p>
                    <p className="text-xs text-slate-500">
                      Abierta el{" "}
                      {new Date(sesion.openedAt).toLocaleString("es-PE")}
                    </p>
                  </div>

                  <p
                    className={`text-lg font-black ${
                      (sesion.diferencia ?? 0) > 0
                        ? "text-sky-300"
                        : "text-rose-300"
                    }`}
                  >
                    {(sesion.diferencia ?? 0) > 0 ? "Sobran " : "Faltan "}
                    {soles(Math.abs(sesion.diferencia ?? 0))}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 text-sm">
                  <div>
                    <p className="text-[11px] uppercase text-slate-500">Fondo</p>
                    <p className="text-slate-200">{soles(sesion.fondo)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-slate-500">
                      Efectivo
                    </p>
                    <p className="text-slate-200">{soles(sesion.efectivo)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-slate-500">
                      Esperado
                    </p>
                    <p className="text-slate-200">{soles(sesion.esperado)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-slate-500">
                      Contado
                    </p>
                    <p className="text-slate-200">{soles(sesion.contado)}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-[11px] uppercase text-slate-500">
                    Justificación del cajero
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {sesion.justificacion}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => autorizar(sesion.id)}
                  disabled={autorizando === sesion.id}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 px-5 py-2.5 rounded-lg text-sm font-bold inline-flex items-center gap-2 transition"
                >
                  {autorizando === sesion.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  Autorizar y cerrar caja
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="rounded-2xl border border-slate-850 bg-slate-900/40 overflow-hidden">
        <div className="p-5 border-b border-slate-850 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-slate-400" />
          <h2 className="text-lg font-bold text-white">Historial de cajas</h2>
        </div>

        {historial.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Todavía no se abrió ninguna caja.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3 font-bold">Cajero</th>
                  <th className="text-left px-5 py-3 font-bold">Apertura</th>
                  <th className="text-left px-5 py-3 font-bold">Fondo</th>
                  <th className="text-left px-5 py-3 font-bold">Efectivo</th>
                  <th className="text-left px-5 py-3 font-bold">Digital</th>
                  <th className="text-left px-5 py-3 font-bold">Diferencia</th>
                  <th className="text-left px-5 py-3 font-bold">Estado</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-850">
                {historial.map((sesion) => (
                  <tr key={sesion.id} className="hover:bg-slate-900/40">
                    <td className="px-5 py-3 text-slate-200">{sesion.cajero}</td>
                    <td className="px-5 py-3 text-slate-400">
                      {new Date(sesion.openedAt).toLocaleString("es-PE")}
                    </td>
                    <td className="px-5 py-3 text-slate-400">
                      {soles(sesion.fondo)}
                    </td>
                    <td className="px-5 py-3 text-emerald-300">
                      {soles(sesion.efectivo)}
                    </td>
                    <td className="px-5 py-3 text-sky-300">
                      {soles(sesion.digital)}
                    </td>
                    <td className="px-5 py-3">
                      {sesion.diferencia === null ? (
                        <span className="text-slate-600">—</span>
                      ) : Math.round(sesion.diferencia * 100) === 0 ? (
                        <span className="text-emerald-400">Cuadró</span>
                      ) : (
                        <span className="text-rose-300">
                          {soles(sesion.diferencia)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-bold text-slate-300">
                        {ESTADOS[sesion.status]}
                      </span>
                      {sesion.autorizadoPor && (
                        <p className="text-[11px] text-slate-500">
                          Autorizó {sesion.autorizadoPor}
                        </p>
                      )}
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
