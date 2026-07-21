"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Loader2,
  LockOpen,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";

type Estado =
  | "PENDING_OPEN"
  | "OPEN"
  | "PENDING_APPROVAL"
  | "CLOSED"
  | "REJECTED";

type Sesion = {
  id: string;
  cajero: string;
  email: string;
  openedAt: string;
  closedAt: string | null;
  status: Estado;
  fondo: number;
  efectivo: number | null;
  digital: number | null;
  esperado: number | null;
  contado: number | null;
  diferencia: number | null;
  justificacion: string | null;
  autorizadoPor: string | null;
};

type Movimiento = {
  id: string;
  tipo: "DEPOSIT" | "WITHDRAWAL";
  monto: number;
  motivo: string;
  fecha: string;
  autor: string;
};

type CajaAbierta = {
  id: string;
  cajero: string;
  email: string;
  openedAt: string;
  fondo: number;
  efectivo: number;
  digital: number;
  entregado: number;
  retirado: number;
  esperadoEnCaja: number;
  movimientos: Movimiento[];
};

type Accion =
  | "autorizar-apertura"
  | "rechazar-apertura"
  | "autorizar-cierre"
  | "rechazar-cierre";

const soles = (monto: number | null) =>
  monto === null
    ? "—"
    : `S/ ${monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

const ESTADOS: Record<Estado, string> = {
  PENDING_OPEN: "Apertura esperando autorización",
  OPEN: "Abierta",
  PENDING_APPROVAL: "Cierre esperando autorización",
  CLOSED: "Cerrada",
  REJECTED: "Apertura rechazada",
};

export default function SesionesCaja() {
  const [aperturas, setAperturas] = useState<Sesion[]>([]);
  const [cierres, setCierres] = useState<Sesion[]>([]);
  const [abiertas, setAbiertas] = useState<CajaAbierta[]>([]);
  const [historial, setHistorial] = useState<Sesion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [resolviendo, setResolviendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Motivo del rechazo, uno por solicitud: hay varias en pantalla a la vez.
  const [motivos, setMotivos] = useState<Record<string, string>>({});

  // Formulario de movimiento de efectivo, uno por caja abierta.
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [motivosMovimiento, setMotivosMovimiento] = useState<
    Record<string, string>
  >({});

  const cargar = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/cajas/sesiones", {
        cache: "no-store",
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error);

      setAperturas(json.aperturas);
      setCierres(json.cierres);
      setAbiertas(json.abiertas);
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

  const moverEfectivo = async (
    sessionId: string,
    tipo: "DEPOSIT" | "WITHDRAWAL"
  ) => {
    setResolviendo(sessionId);
    setError(null);
    setAviso(null);

    try {
      const response = await fetch("/api/admin/cajas/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          tipo,
          amount: Number(montos[sessionId] ?? ""),
          reason: motivosMovimiento[sessionId] ?? "",
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error);

      setAviso(json.message);
      setMontos((previos) => ({ ...previos, [sessionId]: "" }));
      setMotivosMovimiento((previos) => ({ ...previos, [sessionId]: "" }));

      await cargar();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResolviendo(null);
    }
  };

  const resolver = async (sessionId: string, accion: Accion) => {
    setResolviendo(sessionId);
    setError(null);
    setAviso(null);

    try {
      const response = await fetch("/api/admin/cajas/sesiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          accion,
          reason: motivos[sessionId] ?? "",
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error);

      setMotivos((previos) => {
        const { [sessionId]: _descartado, ...resto } = previos;
        return resto;
      });

      await cargar();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResolviendo(null);
    }
  };

  /** Campo del motivo + los dos botones, iguales para apertura y cierre. */
  const Decision = ({
    sesion,
    autorizar,
    rechazar,
    etiquetaAutorizar,
  }: {
    sesion: Sesion;
    autorizar: Accion;
    rechazar: Accion;
    etiquetaAutorizar: string;
  }) => (
    <div className="space-y-3">
      <label className="block">
        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
          Motivo del rechazo (opcional)
        </span>

        <input
          value={motivos[sesion.id] ?? ""}
          onChange={(e) =>
            setMotivos((previos) => ({
              ...previos,
              [sesion.id]: e.target.value,
            }))
          }
          placeholder="Se lo verá el cajero si rechazas la solicitud."
          className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 outline-none focus:border-amber-400"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => resolver(sesion.id, autorizar)}
          disabled={resolviendo === sesion.id}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 px-5 py-2.5 rounded-lg text-sm font-bold inline-flex items-center gap-2 transition"
        >
          {resolviendo === sesion.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )}
          {etiquetaAutorizar}
        </button>

        <button
          type="button"
          onClick={() => resolver(sesion.id, rechazar)}
          disabled={resolviendo === sesion.id}
          className="border border-rose-500/40 text-rose-200 hover:bg-rose-500/10 disabled:opacity-50 px-5 py-2.5 rounded-lg text-sm font-bold inline-flex items-center gap-2 transition"
        >
          <XCircle className="w-4 h-4" />
          Rechazar
        </button>
      </div>
    </div>
  );

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

      {aviso && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{aviso}</span>
        </div>
      )}

      {/* Solicitudes de apertura */}
      <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 overflow-hidden">
        <div className="p-5 border-b border-sky-500/20 flex items-center gap-2">
          <LockOpen className="w-4 h-4 text-sky-400" />
          <h2 className="text-lg font-bold text-white">
            Aperturas esperando autorización
          </h2>
        </div>

        {aperturas.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
            No hay aperturas pendientes.
          </div>
        ) : (
          <div className="divide-y divide-slate-850">
            {aperturas.map((sesion) => (
              <div key={sesion.id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{sesion.cajero}</p>
                    <p className="text-xs text-slate-500">
                      Solicitada el{" "}
                      {new Date(sesion.openedAt).toLocaleString("es-PE")}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[11px] uppercase text-slate-500">
                      Fondo solicitado
                    </p>
                    <p className="text-lg font-black text-sky-300">
                      {soles(sesion.fondo)}
                    </p>
                  </div>
                </div>

                <Decision
                  sesion={sesion}
                  autorizar="autorizar-apertura"
                  rechazar="rechazar-apertura"
                  etiquetaAutorizar="Autorizar apertura"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Solicitudes de cierre */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
        <div className="p-5 border-b border-amber-500/20 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <h2 className="text-lg font-bold text-white">
            Cierres esperando autorización
          </h2>
        </div>

        {cierres.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
            No hay cierres pendientes.
          </div>
        ) : (
          <div className="divide-y divide-slate-850">
            {cierres.map((sesion) => {
              const cuadra = Math.round((sesion.diferencia ?? 0) * 100) === 0;

              return (
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
                        cuadra
                          ? "text-emerald-300"
                          : (sesion.diferencia ?? 0) > 0
                          ? "text-sky-300"
                          : "text-rose-300"
                      }`}
                    >
                      {cuadra
                        ? "Cuadra"
                        : `${
                            (sesion.diferencia ?? 0) > 0 ? "Sobran " : "Faltan "
                          }${soles(Math.abs(sesion.diferencia ?? 0))}`}
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

                  {/* Solo hay justificación cuando el conteo no cuadró. */}
                  {sesion.justificacion && (
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                      <p className="text-[11px] uppercase text-slate-500">
                        Justificación del cajero
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {sesion.justificacion}
                      </p>
                    </div>
                  )}

                  <Decision
                    sesion={sesion}
                    autorizar="autorizar-cierre"
                    rechazar="rechazar-cierre"
                    etiquetaAutorizar="Autorizar y cerrar caja"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cajas operativas: acá se les entrega o retira efectivo */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
        <div className="p-5 border-b border-emerald-500/20 flex items-center gap-2">
          <Banknote className="w-4 h-4 text-emerald-400" />
          <h2 className="text-lg font-bold text-white">Cajas abiertas</h2>
        </div>

        {abiertas.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No hay ninguna caja operando en este momento.
          </div>
        ) : (
          <div className="divide-y divide-slate-850">
            {abiertas.map((caja) => {
              const monto = montos[caja.id] ?? "";
              const motivo = motivosMovimiento[caja.id] ?? "";
              const incompleto =
                monto === "" || Number(monto) <= 0 || motivo.trim().length < 5;

              return (
                <div key={caja.id} className="p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">{caja.cajero}</p>
                      <p className="text-xs text-slate-500">
                        Abierta el{" "}
                        {new Date(caja.openedAt).toLocaleString("es-PE")}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] uppercase text-slate-500">
                        Efectivo en el cajón
                      </p>
                      <p className="text-lg font-black text-emerald-300">
                        {soles(caja.esperadoEnCaja)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4 text-sm">
                    <div>
                      <p className="text-[11px] uppercase text-slate-500">Fondo</p>
                      <p className="text-slate-200">{soles(caja.fondo)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase text-slate-500">
                        Cobrado efectivo
                      </p>
                      <p className="text-slate-200">{soles(caja.efectivo)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase text-slate-500">
                        Cobrado Yape
                      </p>
                      <p className="text-slate-500">
                        {soles(caja.digital)}
                        <span className="block text-[10px]">
                          no está en el cajón
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase text-slate-500">
                        Entregado / retirado
                      </p>
                      <p className="text-slate-200">
                        <span className="text-emerald-300">
                          +{soles(caja.entregado)}
                        </span>{" "}
                        <span className="text-rose-300">
                          −{soles(caja.retirado)}
                        </span>
                      </p>
                    </div>
                  </div>

                  {caja.movimientos.length > 0 && (
                    <ul className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-1.5">
                      {caja.movimientos.map((m) => {
                        const entrega = m.tipo === "DEPOSIT";
                        const Icono = entrega ? ArrowDownLeft : ArrowUpRight;

                        return (
                          <li
                            key={m.id}
                            className="flex items-start gap-2 text-xs text-slate-300"
                          >
                            <Icono
                              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                                entrega ? "text-emerald-400" : "text-rose-400"
                              }`}
                            />
                            <span>
                              <span
                                className={
                                  entrega ? "text-emerald-300" : "text-rose-300"
                                }
                              >
                                {entrega ? "+" : "−"} {soles(m.monto)}
                              </span>{" "}
                              · {m.motivo}{" "}
                              <span className="text-slate-600">
                                ({m.autor},{" "}
                                {new Date(m.fecha).toLocaleString("es-PE")})
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {/* Solo efectivo: lo cobrado por Yape ya está en la cuenta
                      digital y nunca pasó por el cajón. */}
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <label className="sm:w-40">
                        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                          Monto en efectivo
                        </span>

                        <input
                          value={monto}
                          onChange={(e) =>
                            setMontos((previos) => ({
                              ...previos,
                              [caja.id]: e.target.value.replace(/[^\d.]/g, ""),
                            }))
                          }
                          inputMode="decimal"
                          placeholder="0.00"
                          className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 outline-none focus:border-amber-400"
                        />
                      </label>

                      <label className="flex-1">
                        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                          Motivo
                        </span>

                        <input
                          value={motivo}
                          onChange={(e) =>
                            setMotivosMovimiento((previos) => ({
                              ...previos,
                              [caja.id]: e.target.value,
                            }))
                          }
                          placeholder="Queda asentado en la caja y en la auditoría."
                          className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 outline-none focus:border-amber-400"
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => moverEfectivo(caja.id, "DEPOSIT")}
                        disabled={resolviendo === caja.id || incompleto}
                        className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 px-5 py-2.5 rounded-lg text-sm font-bold inline-flex items-center gap-2 transition"
                      >
                        {resolviendo === caja.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ArrowDownLeft className="w-4 h-4" />
                        )}
                        Entregar efectivo
                      </button>

                      <button
                        type="button"
                        onClick={() => moverEfectivo(caja.id, "WITHDRAWAL")}
                        disabled={resolviendo === caja.id || incompleto}
                        className="border border-rose-500/40 text-rose-200 hover:bg-rose-500/10 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 rounded-lg text-sm font-bold inline-flex items-center gap-2 transition"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        Retirar efectivo
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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
                          Resolvió {sesion.autorizadoPor}
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
