"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Loader2,
  PlayCircle,
  RotateCcw,
} from "lucide-react";

interface Corrida {
  id: string;
  status: "RUNNING" | "RESTORED";
  realStartedAt: string;
  simulatedStartAt: string;
  simulatedEndAt: string | null;
  restoredAt: string | null;
  startedByEmail: string | null;
  _count: { changes: number };
}

interface Cambio {
  id: string;
  model: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  recordId: string | null;
  description: string | null;
  createdAt: string;
}

const COLOR_OPERACION: Record<string, string> = {
  CREATE: "text-emerald-400",
  UPDATE: "text-amber-400",
  DELETE: "text-rose-400",
};

export default function DevSimulacionesPage() {
  const [historial, setHistorial] = useState<Corrida[]>([]);
  const [enCurso, setEnCurso] = useState<Corrida | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [abierta, setAbierta] = useState<string | null>(null);
  const [cambios, setCambios] = useState<Cambio[]>([]);
  const [resumen, setResumen] = useState<Record<string, Record<string, number>>>({});
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);

    try {
      const response = await fetch("/api/dev/simulaciones", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setHistorial(data.historial || []);
      setEnCurso(data.enCurso || null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirDetalle = async (id: string) => {
    if (abierta === id) {
      setAbierta(null);
      return;
    }

    setAbierta(id);
    setCargandoDetalle(true);

    try {
      const response = await fetch(`/api/dev/simulaciones/${id}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setCambios(data.cambios || []);
      setResumen(data.resumen || {});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const fecha = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("es-PE") : "—";

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-850">
        <h1 className="text-2xl font-bold text-white">Simulaciones de tiempo</h1>
        <p className="text-slate-400 text-sm mt-1">
          Cada vez que se adelanta el reloj se abre una corrida y se anota toda
          escritura en la base. Al restablecer, esos cambios se deshacen y la
          corrida queda archivada acá.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {enCurso && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <PlayCircle className="w-5 h-5" />
            Simulación en curso
          </div>
          <p className="mt-2 text-sm text-amber-100/80">
            Iniciada el {fecha(enCurso.realStartedAt)} por{" "}
            {enCurso.startedByEmail || "un usuario sin sesión"}.
          </p>
          <p className="mt-1 text-sm text-amber-100/80">
            Cambios anotados hasta ahora:{" "}
            <strong className="text-amber-200">{enCurso._count.changes}</strong>
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-850 bg-slate-900/40 overflow-hidden">
        <div className="p-5 border-b border-slate-850">
          <h2 className="text-lg font-bold text-white">Historial</h2>
        </div>

        {cargando ? (
          <div className="p-10 text-center">
            <Loader2 className="w-5 h-5 mx-auto animate-spin text-slate-500" />
          </div>
        ) : historial.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">
            <Database className="w-8 h-8 mx-auto mb-3 opacity-40" />
            Todavía no se registró ninguna simulación.
          </div>
        ) : (
          <div className="divide-y divide-slate-850">
            {historial.map((corrida) => (
              <div key={corrida.id}>
                <button
                  onClick={() => abrirDetalle(corrida.id)}
                  className="w-full p-5 flex items-center justify-between gap-4 text-left transition hover:bg-slate-900/60"
                >
                  <div className="flex items-start gap-3">
                    {abierta === corrida.id ? (
                      <ChevronDown className="w-4 h-4 mt-1 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 mt-1 text-slate-500" />
                    )}

                    <div>
                      <p className="text-white font-semibold">
                        {fecha(corrida.realStartedAt)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Reloj: {fecha(corrida.simulatedStartAt)} →{" "}
                        {fecha(corrida.simulatedEndAt)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {corrida.startedByEmail || "sin sesión"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span
                      className={`text-xs font-bold ${
                        corrida.status === "RUNNING"
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {corrida.status === "RUNNING" ? "En curso" : "Revertida"}
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {corrida._count.changes} cambio(s)
                    </p>
                  </div>
                </button>

                {abierta === corrida.id && (
                  <div className="border-t border-slate-850 bg-slate-950/50 p-5">
                    {cargandoDetalle ? (
                      <Loader2 className="w-4 h-4 mx-auto animate-spin text-slate-500" />
                    ) : (
                      <>
                        {Object.keys(resumen).length > 0 && (
                          <div className="mb-5 flex flex-wrap gap-2">
                            {Object.entries(resumen).map(([modelo, ops]) => (
                              <span
                                key={modelo}
                                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs"
                              >
                                <span className="text-slate-300 font-semibold">
                                  {modelo}
                                </span>
                                {Object.entries(ops)
                                  .filter(([, n]) => n > 0)
                                  .map(([op, n]) => (
                                    <span
                                      key={op}
                                      className={`ml-2 ${COLOR_OPERACION[op]}`}
                                    >
                                      {op[0]}
                                      {n}
                                    </span>
                                  ))}
                              </span>
                            ))}
                          </div>
                        )}

                        {cambios.length === 0 ? (
                          <p className="text-sm text-slate-500">
                            No se anotaron cambios en esta corrida.
                          </p>
                        ) : (
                          <div className="max-h-80 overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead className="text-slate-500 uppercase tracking-wider">
                                <tr>
                                  <th className="text-left py-2">Hora</th>
                                  <th className="text-left py-2">Modelo</th>
                                  <th className="text-left py-2">Operación</th>
                                  <th className="text-left py-2">Registro</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-850">
                                {cambios.map((c) => (
                                  <tr key={c.id}>
                                    <td className="py-2 text-slate-500 font-mono">
                                      {new Date(c.createdAt).toLocaleTimeString(
                                        "es-PE"
                                      )}
                                    </td>
                                    <td className="py-2 text-slate-300">
                                      {c.model}
                                    </td>
                                    <td
                                      className={`py-2 font-bold ${
                                        COLOR_OPERACION[c.operation]
                                      }`}
                                    >
                                      {c.operation}
                                    </td>
                                    <td className="py-2 text-slate-600 font-mono truncate max-w-[140px]">
                                      {c.recordId || "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-850 bg-slate-900/40 p-5">
        <div className="flex items-start gap-3 text-slate-400">
          <RotateCcw className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p className="text-xs leading-relaxed">
            La reversión se hace desde el botón{" "}
            <strong className="text-slate-300">
              Restablecer a la fecha real
            </strong>{" "}
            del simulador flotante. Los cambios se deshacen del más reciente al
            más antiguo, para respetar las dependencias entre tablas.
          </p>
        </div>
      </div>
    </div>
  );
}
