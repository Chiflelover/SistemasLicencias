"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Hourglass,
  Loader2,
  Lock,
  LockOpen,
  Wallet,
  XCircle,
} from "lucide-react";

type Movimiento = {
  id: string;
  tipo: "DEPOSIT" | "WITHDRAWAL";
  monto: number;
  motivo: string;
  fecha: string;
  autor: string;
};

type Totales = {
  operaciones: number;
  fondo: number;
  efectivo: number;
  digital: number;
  entregado: number;
  retirado: number;
  esperadoEnCaja: number;
  movimientos: Movimiento[];
};

type EstadoCajaData = {
  montoSugerido: number;
  apertura: {
    id: string;
    solicitadaEn: string;
    openingAmount: number;
  } | null;
  abierta: {
    id: string;
    openedAt: string;
    openingAmount: number;
    cierreRechazado: string | null;
  } | null;
  pendienteCierre: {
    id: string;
    diferencia: number;
    justificacion: string | null;
  } | null;
  aperturaRechazada: { motivo: string | null } | null;
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

  const solicitarApertura = async () => {
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

  const solicitarCierre = async () => {
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

  // Solo se ofrece pedir la apertura cuando no hay nada en curso: ni caja
  // abierta, ni apertura esperando, ni cierre esperando.
  const puedeSolicitarApertura =
    !data?.abierta && !data?.apertura && !data?.pendienteCierre;

  return (
    <div className="rounded-2xl border border-slate-850 bg-slate-900/40 overflow-hidden">
      <div className="p-5 border-b border-slate-850 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-amber-400" />
          <h2 className="text-lg font-bold text-white">Caja</h2>
        </div>

        <p className="text-xs text-slate-500 text-right max-w-xs">
          La apertura y el cierre los autoriza el administrador. Puedes pedirlos
          a cualquier hora.
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

        {/* Apertura esperando al administrador */}
        {data?.apertura && (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-4 text-sm">
            <p className="font-bold text-white flex items-center gap-2">
              <Hourglass className="w-4 h-4 shrink-0" />
              Apertura esperando autorización
            </p>

            <p className="mt-1 text-sky-200">
              Pediste abrir con un fondo de{" "}
              {soles(data.apertura.openingAmount)}. Hasta que el administrador lo
              autorice no vas a poder registrar cobros.
            </p>

            <p className="mt-2 text-xs text-slate-400">
              Solicitada el{" "}
              {new Date(data.apertura.solicitadaEn).toLocaleString("es-PE")}
            </p>
          </div>
        )}

        {/* Cierre esperando al administrador */}
        {data?.pendienteCierre && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <p className="font-bold text-white flex items-center gap-2">
              <Hourglass className="w-4 h-4 shrink-0" />
              Cierre esperando autorización
            </p>

            <p className="mt-1 text-amber-200">
              {Math.round(data.pendienteCierre.diferencia * 100) === 0
                ? "El conteo cuadró con el sistema."
                : `${
                    data.pendienteCierre.diferencia > 0 ? "Sobran " : "Faltan "
                  }${soles(Math.abs(data.pendienteCierre.diferencia))}.`}{" "}
              El administrador tiene que autorizar el cierre para que puedas
              abrir una caja nueva.
            </p>

            {data.pendienteCierre.justificacion && (
              <p className="mt-2 text-xs text-slate-400">
                Motivo declarado: {data.pendienteCierre.justificacion}
              </p>
            )}
          </div>
        )}

        {/* La apertura anterior fue rechazada: se puede pedir otra */}
        {puedeSolicitarApertura && data?.aperturaRechazada && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm">
            <p className="font-bold text-white flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              El administrador rechazó tu apertura
            </p>

            {data.aperturaRechazada.motivo && (
              <p className="mt-1 text-rose-200">
                Motivo: {data.aperturaRechazada.motivo}
              </p>
            )}

            <p className="mt-1 text-rose-200">
              Puedes volver a solicitarla con el fondo corregido.
            </p>
          </div>
        )}

        {/* Caja cerrada: solicitar apertura */}
        {puedeSolicitarApertura && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              La caja está cerrada. Mientras siga así no podrás registrar
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
                onClick={solicitarApertura}
                disabled={procesando || montoApertura === ""}
                className="self-end bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
              >
                {procesando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LockOpen className="w-4 h-4" />
                )}
                Solicitar apertura
              </button>
            </div>
          </div>
        )}

        {/* Caja abierta: totales y cierre */}
        {data?.abierta && totales && (
          <div className="space-y-4">
            {/* El administrador rechazó el último cierre: hay que contar otra
                vez. Se avisa acá porque la caja volvió a estar operativa y sin
                el aviso el rechazo pasaría desapercibido. */}
            {data.abierta.cierreRechazado && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm">
                <p className="font-bold text-white flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0" />
                  El administrador rechazó tu último cierre
                </p>

                <p className="mt-1 text-rose-200">
                  Motivo: {data.abierta.cierreRechazado}
                </p>

                <p className="mt-1 text-rose-200">
                  Vuelve a contar el efectivo y solicita el cierre de nuevo.
                </p>
              </div>
            )}

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
                  {totales.entregado || totales.retirado
                    ? "Fondo + entregas − retiros + efectivo"
                    : "Fondo + efectivo"}
                </p>
              </div>
            </div>

            {/* Efectivo que movió el administrador durante el turno. Sin esta
                lista el cajero cuenta el cajón, le da otro número y no tiene
                cómo saber de dónde salió la diferencia. */}
            {totales.movimientos.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Efectivo movido por el administrador
                </p>

                <ul className="mt-3 space-y-2">
                  {totales.movimientos.map((m) => {
                    const entrega = m.tipo === "DEPOSIT";
                    const Icono = entrega ? ArrowDownLeft : ArrowUpRight;

                    return (
                      <li key={m.id} className="flex items-start gap-2.5 text-sm">
                        <Icono
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            entrega ? "text-emerald-400" : "text-rose-400"
                          }`}
                        />

                        <div className="min-w-0 flex-1">
                          <p className="text-slate-200">
                            <span
                              className={`font-bold ${
                                entrega ? "text-emerald-300" : "text-rose-300"
                              }`}
                            >
                              {entrega ? "+" : "−"} {soles(m.monto)}
                            </span>{" "}
                            · {m.motivo}
                          </p>

                          <p className="text-[11px] text-slate-500">
                            {m.autor} ·{" "}
                            {new Date(m.fecha).toLocaleString("es-PE")}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

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
                    placeholder="Explica por qué falta o sobra el dinero. Lo va a revisar el administrador."
                    className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-slate-100 outline-none focus:border-amber-400 resize-none"
                  />
                </label>
              )}

              <button
                type="button"
                onClick={solicitarCierre}
                disabled={
                  procesando ||
                  contado === "" ||
                  (!cuadra && justificacion.trim().length < 10)
                }
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed bg-amber-500 hover:bg-amber-400 text-slate-950"
              >
                {procesando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                {/* Siempre lo mismo: el cierre pasa por el administrador
                    cuadre o no, así que el texto no depende del conteo. */}
                Solicitar cierre al administrador
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
