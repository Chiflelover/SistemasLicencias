"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  XCircle,
} from "lucide-react";

type Cuando = "PASADA" | "HOY" | "FUTURA";

type Inspeccion = {
  id: string;
  numero: "FIRST" | "SECOND" | "UNANNOUNCED";
  estado: "SCHEDULED" | "COMPLETED";
  resultado: "APPROVED" | "REJECTED" | null;
  observaciones: string | null;
  scheduledAt: string;
  resultAt: string | null;
  cuando: Cuando;
  inspector: string;
  tramite: string;
  estadoTramite: string;
  ruc: string;
  negocio: string;
};

const ETIQUETA_CUANDO: Record<Cuando, string> = {
  PASADA: "Pasada",
  HOY: "Hoy",
  FUTURA: "Futura",
};

const COLOR_CUANDO: Record<Cuando, string> = {
  PASADA: "text-slate-400 border-slate-700",
  HOY: "text-amber-300 border-amber-500/40",
  FUTURA: "text-sky-300 border-sky-500/40",
};

export default function AdminInspeccionesPage() {
  const [inspecciones, setInspecciones] = useState<Inspeccion[]>([]);
  const [inspectores, setInspectores] = useState<
    Array<{ id: string; fullName: string }>
  >([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [estado, setEstado] = useState("");
  const [inspector, setInspector] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (estado) params.set("estado", estado);
      if (inspector) params.set("inspector", inspector);
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);

      const response = await fetch(`/api/admin/inspecciones?${params}`, {
        cache: "no-store",
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error);

      setInspecciones(json.inspecciones);
      setInspectores(json.inspectores);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [estado, inspector, desde, hasta]);

  useEffect(() => {
    cargar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatear = (iso: string) =>
    new Date(iso).toLocaleString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const cuenta = (c: Cuando) => inspecciones.filter((i) => i.cuando === c).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <Link
          href="/admin"
          className="text-sm text-slate-400 hover:text-white inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al panel
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-white">Inspecciones</h1>
        <p className="mt-1 text-sm text-slate-400">
          Todas las inspecciones del sistema. El inspector solo ve lo que tiene
          pendiente hoy, así que este es el único registro de lo ya realizado.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-850 bg-slate-900/40 p-5 flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-grow">
          <label className="block text-xs uppercase tracking-wider font-bold text-slate-500 mb-1.5">
            Estado
          </label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">Todas</option>
            <option value="SCHEDULED">Programadas</option>
            <option value="COMPLETED">Realizadas</option>
          </select>
        </div>

        <div className="flex-grow">
          <label className="block text-xs uppercase tracking-wider font-bold text-slate-500 mb-1.5">
            Inspector
          </label>
          <select
            value={inspector}
            onChange={(e) => setInspector(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">Todos</option>
            {inspectores.map((i) => (
              <option key={i.id} value={i.id}>
                {i.fullName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-grow">
          <label className="block text-xs uppercase tracking-wider font-bold text-slate-500 mb-1.5">
            Desde
          </label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex-grow">
          <label className="block text-xs uppercase tracking-wider font-bold text-slate-500 mb-1.5">
            Hasta
          </label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        <button
          onClick={cargar}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-5 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap"
        >
          Filtrar
        </button>

        <button
          onClick={() => {
            setEstado("");
            setInspector("");
            setDesde("");
            setHasta("");
            // Se limpian los filtros y se recarga en el mismo gesto: cargar()
            // todavía tiene los valores viejos en su clausura, así que se pide
            // sin parámetros a mano.
            fetch("/api/admin/inspecciones", { cache: "no-store" })
              .then((r) => r.json())
              .then((json) => {
                setInspecciones(json.inspecciones);
                setInspectores(json.inspectores);
              })
              .catch((e) => setError(e.message));
          }}
          className="border border-slate-700 hover:border-slate-500 text-slate-300 px-5 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap"
        >
          Todo
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {cargando ? (
        <div className="p-12 text-center">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-slate-500" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {(["PASADA", "HOY", "FUTURA"] as const).map((c) => (
              <div
                key={c}
                className="rounded-2xl border border-slate-850 bg-slate-900/40 p-5"
              >
                <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider font-bold">
                  {c === "HOY" ? (
                    <Clock3 className="w-4 h-4" />
                  ) : (
                    <CalendarDays className="w-4 h-4" />
                  )}
                  {ETIQUETA_CUANDO[c]}
                </div>
                <p className="mt-2 text-3xl font-black text-white">{cuenta(c)}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-850 bg-slate-900/40 overflow-hidden">
            <div className="p-5 border-b border-slate-850">
              <h2 className="text-lg font-bold text-white">
                {inspecciones.length}{" "}
                {inspecciones.length === 1 ? "inspección" : "inspecciones"}
              </h2>
            </div>

            {inspecciones.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No hay inspecciones que coincidan con el filtro.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-950/50 text-slate-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-5 py-3 font-bold">Fecha</th>
                      <th className="text-left px-5 py-3 font-bold">Trámite</th>
                      <th className="text-left px-5 py-3 font-bold">Negocio</th>
                      <th className="text-left px-5 py-3 font-bold">Inspector</th>
                      <th className="text-left px-5 py-3 font-bold">Visita</th>
                      <th className="text-left px-5 py-3 font-bold">Resultado</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-850">
                    {inspecciones.map((i) => (
                      <tr key={i.id} className="hover:bg-slate-900/40 align-top">
                        <td className="px-5 py-3 whitespace-nowrap">
                          <p className="text-slate-200">
                            {formatear(i.scheduledAt)}
                          </p>
                          <span
                            className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                              COLOR_CUANDO[i.cuando]
                            }`}
                          >
                            {ETIQUETA_CUANDO[i.cuando]}
                          </span>
                        </td>

                        <td className="px-5 py-3 font-mono text-amber-300 whitespace-nowrap">
                          {i.tramite}
                        </td>

                        <td className="px-5 py-3">
                          <p className="text-slate-200">{i.negocio}</p>
                          <p className="text-xs text-slate-500 font-mono">
                            {i.ruc}
                          </p>
                        </td>

                        <td className="px-5 py-3 text-slate-300">
                          {i.inspector}
                        </td>

                        <td className="px-5 py-3 text-slate-400 whitespace-nowrap">
                          {i.numero === "FIRST"
                            ? "Primera"
                            : i.numero === "SECOND"
                              ? "Segunda"
                              : "Inopinada"}
                        </td>

                        <td className="px-5 py-3">
                          {i.estado === "SCHEDULED" ? (
                            <span className="text-slate-400">Pendiente</span>
                          ) : i.resultado === "APPROVED" ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-300">
                              <CheckCircle2 className="w-4 h-4" />
                              Aprobada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-rose-300">
                              <XCircle className="w-4 h-4" />
                              Observada
                            </span>
                          )}

                          {i.observaciones && (
                            <p className="mt-1 max-w-md text-xs text-slate-500">
                              {i.observaciones}
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
        </>
      )}
    </div>
  );
}
