"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  Lock,
  LockOpen,
  Wallet,
} from "lucide-react";

type Totales = {
  operaciones: number;
  fondo: number;
  efectivo: number;
  digital: number;
  esperadoEnCaja: number;
};

type EstadoCajaData = {
  montoSugerido: number;
  abierta: { id: string; openedAt: string; openingAmount: number } | null;
  pendiente: { id: string; diferencia: number; justificacion: string } | null;
  totales: Totales | null;
};

const soles = (monto: number) =>
  `S/ ${monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

export default function EstadoCaja() {
  const router = useRouter();

  const [data, setData] = useState<EstadoCajaData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [montoApertura, setMontoApertura] = useState("");
  const [contado, setContado] = useState("");
  const [justificacion, setJustificacion] = useState("");

  const cargar = useCallback(async () => {
    try {
      const response = await fetch("/api/cajero/caja", { cache: "no-store" });
      const json = await response.json();

      if (!response.ok) throw new Error(json.error);

      setData(json);
      setMontoApertura(String(json.montoSugerido));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrir = async () => {
    setProcesando(true);
    setError(null);
    setAviso(null);

    try {
      const response = await fetch("/api/cajero/caja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingAmount: Number(montoApertura) }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error);

      setAviso(json.message);
      await cargar();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const cerrar = async () => {
    setProcesando(true);
    setError(null);
    setAviso(null);

    try {
      const response = await fetch("/api/cajero/caja/cerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countedAmount: Number(contado),
          justification: justificacion,
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error);

      setAviso(json.message);
      setContado("");
      setJustificacion("");
      await cargar();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) {
    return (
      <div className="rounded-2xl border border-slate-850 bg-slate-900/40 p-8 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      </div>
    );
  }

  const totales = data?.totales;
  const diferencia =
    totales && contado !== "" ? Number(contado) - totales.esperadoEnCaja : null;
  const cuadra = diferencia !== null && Math.round(diferencia * 100) === 0;

  return (
    <div className="rounded-2xl border border-slate-850 bg-slate-900/40 overflow-hidden">
      <div className="p-5 border-b border-slate-850 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-amber-400" />
          <h2 className="text-lg font-bold text-white">Caja</h2>
        </div>

        <p className="text-xs text-slate-500 flex items-center gap-1.5 text-right">
          <Clock3 className="w-3.5 h-3.5 shrink-0" />
          La caja se cierra a partir de las 8 de la noche.
        </p>
      </div>

      <div className="p-5 space-y-4">
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

        {/* Esperando al administrador */}
        {data?.pendiente && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <p className="font-bold text-white">
              Cierre esperando autorización
            </p>

            <p className="mt-1 text-amber-200">
              {data.pendiente.diferencia > 0 ? "Sobran " : "Faltan "}
              {soles(Math.abs(data.pendiente.diferencia))}. El administrador
              tiene que autorizar el cierre para que puedas abrir una caja nueva.
            </p>

            <p className="mt-2 text-xs text-slate-400">
              Motivo declarado: {data.pendiente.justificacion}
            </p>
          </div>
        )}

        {/* Caja cerrada: abrir */}
        {!data?.abierta && !data?.pendiente && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              La caja está cerrada. Mientras siga así no vas a poder registrar
              cobros.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex-1">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Fondo inicial
                </span>

                <input
                  value={montoApertura}
                  onChange={(e) =>
                    setMontoApertura(e.target.value.replace(/[^\d.]/g, ""))
                  }
                  inputMode="decimal"
                  className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-slate-100 outline-none focus:border-amber-400"
                />
              </label>

              <button
                type="button"
                onClick={abrir}
                disabled={procesando || montoApertura === ""}
                className="self-end bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
              >
                {procesando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LockOpen className="w-4 h-4" />
                )}
                Abrir caja
              </button>
            </div>
          </div>
        )}

        {/* Caja abierta: totales y cierre */}
        {data?.abierta && totales && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Caja abierta desde{" "}
              {new Date(data.abierta.openedAt).toLocaleString("es-PE")} con un
              fondo de {soles(totales.fondo)}.
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                  Recaudado efectivo
                </p>
                <p className="mt-1 text-xl font-black text-emerald-400">
                  {soles(totales.efectivo)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                  Recaudado digital
                </p>
                <p className="mt-1 text-xl font-black text-sky-400">
                  {soles(totales.digital)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  No pasa por el cajón
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-[11px] uppercase tracking-wider text-amber-400 font-bold">
                  Debe haber en caja
                </p>
                <p className="mt-1 text-xl font-black text-white">
                  {soles(totales.esperadoEnCaja)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Fondo + efectivo
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Efectivo contado a mano
                </span>

                <input
                  value={contado}
                  onChange={(e) =>
                    setContado(e.target.value.replace(/[^\d.]/g, ""))
                  }
                  inputMode="decimal"
                  placeholder="0.00"
                  className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-slate-100 outline-none focus:border-amber-400"
                />
              </label>

              {diferencia !== null && contado !== "" && (
                <p
                  className={`text-sm font-semibold ${
                    cuadra ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {cuadra
                    ? "Cuadra con el sistema."
                    : diferencia > 0
                    ? `Sobran ${soles(diferencia)}.`
                    : `Faltan ${soles(Math.abs(diferencia))}.`}
                </p>
              )}

              {/* La justificación solo aparece si no cuadra: pedirla siempre
                  invitaría a completarla de más. */}
              {diferencia !== null && contado !== "" && !cuadra && (
                <label className="block">
                  <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                    Motivo del descuadre
                  </span>

                  <textarea
                    value={justificacion}
                    onChange={(e) => setJustificacion(e.target.value)}
                    rows={3}
                    placeholder="Explicá por qué falta o sobra el dinero. Lo va a revisar el administrador."
                    className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-slate-100 outline-none focus:border-amber-400 resize-none"
                  />
                </label>
              )}

              <button
                type="button"
                onClick={cerrar}
                disabled={
                  procesando ||
                  contado === "" ||
                  (!cuadra && justificacion.trim().length < 10)
                }
                className={`w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  cuadra || contado === ""
                    ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                    : "bg-amber-500 hover:bg-amber-400 text-slate-950"
                }`}
              >
                {procesando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                {/* Antes de contar no se sabe si cuadra: anunciar la
                    solicitud al administrador daría a entender que ya hay un
                    descuadre. */}
                {contado === ""
                  ? "Cerrar caja"
                  : cuadra
                  ? "Cerrar caja"
                  : "Solicitar cierre al administrador"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
