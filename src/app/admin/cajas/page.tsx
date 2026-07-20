"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SesionesCaja from "@/components/SesionesCaja";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Wallet,
  TrendingUp,
} from "lucide-react";

interface Caja {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  operaciones: number;
  total: number;
  porMetodo: Array<{ metodo: string; operaciones: number; total: number }>;
}

const METODOS = ["EFECTIVO", "TARJETA", "YAPE", "PLIN"];

export default function AdminCajasPage() {
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [totalGeneral, setTotalGeneral] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const cargar = useCallback(async (conRango = false) => {
    setCargando(true);
    setError(null);

    try {
      const query = conRango && desde && hasta ? `?desde=${desde}&hasta=${hasta}` : "";
      const response = await fetch(`/api/admin/cajas${query}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setCajas(data.cajas || []);
      setTotalGeneral(data.totalGeneral || 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    cargar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const maximo = Math.max(...cajas.map((c) => c.total), 1);

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
        <h1 className="mt-4 text-2xl font-bold text-white">Recaudación por caja</h1>
        <p className="mt-1 text-sm text-slate-400">
          Cada cajero es una ventanilla. Los pagos guardan quién los recibió.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-850 bg-slate-900/40 p-5 flex flex-col sm:flex-row sm:items-end gap-3">
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
          onClick={() => cargar(true)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-5 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap"
        >
          Filtrar
        </button>

        <button
          onClick={() => {
            setDesde("");
            setHasta("");
            cargar(false);
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
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
            <div className="flex items-center gap-2 text-amber-400 text-xs uppercase tracking-wider font-bold">
              <TrendingUp className="w-4 h-4" />
              Total recaudado
            </div>
            <p className="mt-2 text-4xl font-black text-white">
              S/ {totalGeneral.toFixed(2)}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Sumando {cajas.length} {cajas.length === 1 ? "caja" : "cajas"}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {cajas.map((caja) => (
              <div
                key={caja.id}
                className="rounded-2xl border border-slate-850 bg-slate-900/40 p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-amber-400" />
                      <h2 className="font-bold text-white">{caja.nombre}</h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{caja.email}</p>
                  </div>

                  {!caja.activo && (
                    <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-400">
                      Inactiva
                    </span>
                  )}
                </div>

                <p className="mt-4 text-3xl font-black text-white">
                  S/ {caja.total.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500">
                  {caja.operaciones}{" "}
                  {caja.operaciones === 1 ? "operación" : "operaciones"}
                </p>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${(caja.total / maximo) * 100}%` }}
                  />
                </div>

                <div className="mt-5 space-y-2">
                  {METODOS.map((metodo) => {
                    const dato = caja.porMetodo.find((m) => m.metodo === metodo);
                    const total = dato?.total ?? 0;
                    const ops = dato?.operaciones ?? 0;

                    return (
                      <div
                        key={metodo}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-400">{metodo}</span>
                        <span className="text-slate-300">
                          <span className="text-slate-600">{ops} ops · </span>
                          <span className="font-bold text-white">
                            S/ {total.toFixed(2)}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Turnos de caja: aperturas, cierres y los descuadres que hay que
          autorizar. Va debajo de la recaudación, que es lo que más se mira. */}
      <SesionesCaja />
    </div>
  );
}
