"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Gavel, Loader2 } from "lucide-react";

type Gravedad = { nombre: string; porcentaje: number; monto: number };

type Datos = {
  amount: number;
  porDefecto: number;
  minimo: number;
  maximo: number;
  gravedades: Gravedad[];
};

const soles = (monto: number) =>
  `S/ ${monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

/**
 * Valor de la UIT, de donde salen los montos de las multas.
 *
 * Va en el panel del administrador y no en el código porque **cambia por
 * decreto todos los años**: en 2026 son S/ 5 500 (D.S. 301-2025-EF), contra
 * S/ 5 350 en 2025. Sin esto, cada enero habría que tocar el código.
 *
 * Muestra la escala resultante debajo para que se vea el efecto antes de
 * guardar: cambiar un número suelto sin ver en qué se convierte es fácil de
 * equivocar.
 */
export default function ValorUit() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [monto, setMonto] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/uit", { cache: "no-store" });
      const json = await response.json();

      if (!response.ok) throw new Error(json.error);

      setDatos(json);
      setMonto(String(json.amount));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    setAviso(null);

    try {
      const response = await fetch("/api/admin/uit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(monto) }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error);

      setAviso(json.message);
      await cargar();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="rounded-2xl border border-slate-850 bg-slate-900/40 p-8 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      </div>
    );
  }

  const sinCambios =
    datos !== null &&
    Math.round(Number(monto) * 100) === Math.round(datos.amount * 100);

  return (
    <div className="rounded-2xl border border-slate-850 bg-slate-900/40 overflow-hidden">
      <div className="p-5 border-b border-slate-850 flex items-center gap-2">
        <Gavel className="w-4 h-4 text-amber-400" />
        <h2 className="text-lg font-bold text-white">Valor de la UIT</h2>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-sm text-slate-400">
          De acá salen los montos de las multas. Cambia por decreto cada año.
        </p>

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

        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="sm:w-56">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">
              Monto en soles
            </span>

            <input
              value={monto}
              onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-slate-100 outline-none focus:border-amber-400"
            />
          </label>

          <button
            type="button"
            onClick={guardar}
            disabled={guardando || monto === "" || sinCambios}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 px-5 py-2.5 rounded-lg text-sm font-bold inline-flex items-center justify-center gap-2 transition"
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar UIT
          </button>
        </div>

        {/* La escala vigente. Se muestra para que el efecto del cambio se vea
            antes de guardar, no después de poner una multa. */}
        {datos && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">
              Escala de multas vigente
            </p>

            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {datos.gravedades.map((g) => (
                <li
                  key={g.nombre}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="text-slate-300">
                    {g.nombre}{" "}
                    <span className="text-slate-500">({g.porcentaje}%)</span>
                  </span>
                  <span className="font-bold text-amber-300">{soles(g.monto)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
