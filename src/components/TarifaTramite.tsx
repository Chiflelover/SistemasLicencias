"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Tag } from "lucide-react";

type Datos = {
  amount: number;
  porDefecto: number;
  minimo: number;
  maximo: number;
};

export default function TarifaTramite() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [monto, setMonto] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/tarifa", { cache: "no-store" });
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
      const response = await fetch("/api/admin/tarifa", {
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
    datos !== null && Math.round(Number(monto) * 100) === Math.round(datos.amount * 100);

  return (
    <div className="rounded-2xl border border-slate-850 bg-slate-900/40 overflow-hidden">
      <div className="p-5 border-b border-slate-850 flex items-center gap-2">
        <Tag className="w-4 h-4 text-amber-400" />
        <h2 className="text-lg font-bold text-white">
          Tarifa del derecho de trámite
        </h2>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-sm text-slate-400">
          Es lo que se cobra por cada trámite, en ventanilla y por la web. Rige
          la tarifa vigente el día que se paga: los trámites ya cobrados
          conservan su monto y sus facturas no cambian.
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
            Guardar tarifa
          </button>
        </div>

        {/* El tope no es arbitrario: por encima del billete de mayor
            denominación no habría forma de cobrar en efectivo. */}
        {datos && (
          <p className="text-xs text-slate-500">
            Entre S/ {datos.minimo.toFixed(2)} y S/ {datos.maximo.toFixed(2)}.
            El tope es el billete de mayor denominación: con una tarifa mayor no
            se podría cobrar en efectivo. De fábrica son S/{" "}
            {datos.porDefecto.toFixed(2)}, y a ese valor vuelve al restablecer
            el sistema.
          </p>
        )}
      </div>
    </div>
  );
}
