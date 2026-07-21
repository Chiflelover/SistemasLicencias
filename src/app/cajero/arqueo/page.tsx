"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import EstadoCaja from "@/components/EstadoCaja";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CreditCard,
  Loader2,
  Smartphone,
  Wallet,
} from "lucide-react";

const METODOS = [
  { value: "EFECTIVO", label: "Efectivo", icon: Banknote },
  { value: "TARJETA", label: "Tarjeta", icon: CreditCard },
  { value: "YAPE", label: "Yape", icon: Smartphone },
  { value: "PLIN", label: "Plin", icon: Smartphone },
];

interface Arqueo {
  from: string;
  to: string;
  totalOperations: number;
  total: number;
  byMethod: Record<string, { count: number; total: number }>;
  payments: Array<{
    id: string;
    operationNumber: string;
    amount: number;
    method: string | null;
    paidAt: string;
    applicationNumber: string;
    legalName: string;
    ruc: string;
  }>;
}

export default function ArqueoPage() {
  const [arqueo, setArqueo] = useState<Arqueo | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const cargar = useCallback(
    async (conRango = false) => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const query =
          conRango && desde && hasta ? `?desde=${desde}&hasta=${hasta}` : "";

        const response = await fetch(`/api/cajero/arqueo${query}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "No se pudo generar el arqueo.");
        }

        setArqueo(data.arqueo);
      } catch (error: any) {
        setErrorMessage(error.message);
      } finally {
        setLoading(false);
      }
    },
    [desde, hasta]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const formatearHora = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
    });

  // Un pago mixto son dos filas Payment del mismo trámite en el mismo instante.
  // Se agrupan como una sola operación para que no parezcan trámites distintos.
  const agruparOperaciones = (pagos: Arqueo["payments"]) => {
    const grupos = new Map<
      string,
      {
        key: string;
        applicationNumber: string;
        legalName: string;
        paidAt: string;
        operationNumbers: string[];
        formas: Array<{ method: string | null; amount: number }>;
        total: number;
      }
    >();

    for (const pago of pagos) {
      const key = `${pago.applicationNumber}|${pago.paidAt}`;
      const grupo = grupos.get(key) ?? {
        key,
        applicationNumber: pago.applicationNumber,
        legalName: pago.legalName,
        paidAt: pago.paidAt,
        operationNumbers: [],
        formas: [],
        total: 0,
      };

      grupo.operationNumbers.push(pago.operationNumber);
      grupo.formas.push({ method: pago.method, amount: pago.amount });
      grupo.total += pago.amount;
      grupos.set(key, grupo);
    }

    return [...grupos.values()];
  };

  const formatearFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl">
      <div>
        <Link
          href="/cajero"
          className="text-sm text-slate-400 hover:text-white inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al panel
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-white">Arqueo de caja</h1>
        <p className="mt-1 text-sm text-slate-400">
          Abre y cierra tu turno, y consulta lo que cobraste desglosado por
          método de pago.
        </p>
      </div>

      {/* La apertura y el cierre viven acá y no en el panel: son la misma
          tarea que el arqueo, contar lo que hay en el cajón. */}
      <EstadoCaja />

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
            cargar();
          }}
          className="border border-slate-700 hover:border-slate-500 text-slate-300 px-5 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap"
        >
          Hoy
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-slate-500" />
        </div>
      ) : arqueo ? (
        <>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-amber-400 text-xs uppercase tracking-wider font-bold">
                <Wallet className="w-4 h-4" />
                Total recaudado
              </div>
              <p className="mt-2 text-4xl font-black text-white">
                S/ {arqueo.total.toFixed(2)}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                {arqueo.totalOperations}{" "}
                {arqueo.totalOperations === 1 ? "operación" : "operaciones"}
              </p>
            </div>

            <div className="text-sm text-slate-400 sm:text-right">
              <p>Desde {formatearFecha(arqueo.from)}</p>
              <p>Hasta {formatearFecha(arqueo.to)}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {METODOS.map((m) => {
              const Icono = m.icon;
              const datos = arqueo.byMethod[m.value] || { count: 0, total: 0 };

              return (
                <div
                  key={m.value}
                  className="rounded-2xl border border-slate-850 bg-slate-900/40 p-5"
                >
                  <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider font-bold">
                    <Icono className="w-4 h-4" />
                    {m.label}
                  </div>
                  <p className="mt-2 text-2xl font-black text-white">
                    S/ {datos.total.toFixed(2)}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    {datos.count} {datos.count === 1 ? "operación" : "operaciones"}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-850 bg-slate-900/40 overflow-hidden">
            <div className="p-5 border-b border-slate-850">
              <h2 className="text-lg font-bold text-white">Detalle de operaciones</h2>
            </div>

            {arqueo.payments.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No se registraron cobros en este período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-950/50 text-slate-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-5 py-3 font-bold">Operación</th>
                      <th className="text-left px-5 py-3 font-bold">Trámite</th>
                      <th className="text-left px-5 py-3 font-bold">Negocio</th>
                      <th className="text-left px-5 py-3 font-bold">Método</th>
                      <th className="text-left px-5 py-3 font-bold">Hora</th>
                      <th className="text-right px-5 py-3 font-bold">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {agruparOperaciones(arqueo.payments).map((op) => (
                      <tr key={op.key} className="hover:bg-slate-900/40">
                        <td className="px-5 py-3 font-mono text-xs text-slate-400">
                          {op.operationNumbers.map((n) => (
                            <p key={n}>{n}</p>
                          ))}
                        </td>
                        <td className="px-5 py-3 font-mono text-amber-300">
                          {op.applicationNumber}
                        </td>
                        <td className="px-5 py-3 text-slate-200">
                          {op.legalName}
                        </td>
                        <td className="px-5 py-3 text-slate-300">
                          {op.formas.length > 1 ? (
                            <div className="space-y-0.5">
                              {op.formas.map((f, i) => (
                                <p key={i} className="text-xs">
                                  {(f.method || "—")} · S/ {f.amount.toFixed(2)}
                                </p>
                              ))}
                            </div>
                          ) : (
                            op.formas[0]?.method || "—"
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-400 font-mono">
                          {formatearHora(op.paidAt)}
                        </td>
                        <td className="px-5 py-3 text-right text-white font-bold">
                          S/ {op.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
