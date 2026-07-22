"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Hourglass,
  Loader2,
  LockOpen,
  LogOut,
  Wallet,
  XCircle,
} from "lucide-react";
import { INTERVALO_SONDEO_MS, useSondeo } from "@/lib/use-sondeo";

type EstadoCaja = {
  montoSugerido: number;
  apertura: { solicitadaEn: string; openingAmount: number } | null;
  abierta: { id: string } | null;
  pendienteCierre: { diferencia: number } | null;
  aperturaRechazada: { motivo: string | null } | null;
};

const soles = (monto: number) =>
  `S/ ${monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

/**
 * Portón de la ventanilla: sin caja abierta no se atiende.
 *
 * Va montado en el layout del cajero, así que cubre las cinco pantallas de una
 * sola vez. Antes cada una decidía por su cuenta y el resultado era que se
 * podía registrar un trámite completo —con sus dos archivos— para descubrir
 * recién en el cobro que la caja estaba cerrada, dejando el RUC tomado por un
 * trámite a medias.
 *
 * Es comodidad, no seguridad: las rutas del servidor validan lo mismo por su
 * cuenta, porque una petición directa no pasa por acá.
 */
export default function AperturaCajaModal() {
  const router = useRouter();

  const [estado, setEstado] = useState<EstadoCaja | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monto, setMonto] = useState("");
  const [saliendo, setSaliendo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const response = await fetch("/api/cajero/caja", { cache: "no-store" });
      const json = await response.json();

      if (!response.ok) throw new Error(json.error);

      setEstado((previo) => {
        // El fondo se propone una sola vez: recargar cada 20 segundos no debe
        // pisar lo que el cajero esté tipeando.
        if (!previo) setMonto(String(json.montoSugerido));

        // La caja recién autorizada refresca la pantalla de atrás, que hasta
        // ahora mostraba el estado de la caja cerrada.
        if (json.abierta && !previo?.abierta) router.refresh();

        return json;
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const esperando = Boolean(estado?.apertura || estado?.pendienteCierre);

  // Solo se pregunta mientras hay algo que espera resolución del
  // administrador. Con la caja ya abierta, o con nada pedido, no hay nada que
  // pueda cambiar del otro lado y el temporizador ni se instala.
  useSondeo(cargar, INTERVALO_SONDEO_MS, esperando);

  const solicitar = async () => {
    setEnviando(true);
    setError(null);

    try {
      const response = await fetch("/api/cajero/caja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingAmount: Number(monto) }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error);

      await cargar();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const salir = async () => {
    setSaliendo(true);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });

      if (response.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch {
      setSaliendo(false);
    }
  };

  // Mientras carga no se muestra nada: un parpadeo del portón en cada
  // navegación sería peor que esperar la respuesta.
  if (cargando || !estado || estado.abierta) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="p-6 border-b border-slate-850 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-amber-400" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-white">
              {esperando ? "Esperando al administrador" : "Tu caja está cerrada"}
            </h2>
            <p className="text-xs text-slate-500">
              La ventanilla no atiende hasta que la caja esté abierta.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Apertura pedida: no hay nada que hacer más que esperar */}
          {estado.apertura && (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-4 text-sm">
              <p className="font-bold text-white flex items-center gap-2">
                <Hourglass className="w-4 h-4 shrink-0" />
                Apertura solicitada
              </p>

              <p className="mt-1.5 text-sky-200">
                Pediste abrir con un fondo de{" "}
                {soles(estado.apertura.openingAmount)}. Al administrador ya le
                llegó el aviso.
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Esta pantalla se cierra sola en cuanto lo autorice. No hace falta
                recargar.
              </p>
            </div>
          )}

          {/* Cierre pedido: tampoco se puede cobrar hasta que lo resuelvan */}
          {estado.pendienteCierre && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <p className="font-bold text-white flex items-center gap-2">
                <Hourglass className="w-4 h-4 shrink-0" />
                Cierre solicitado
              </p>

              <p className="mt-1.5 text-amber-200">
                {Math.round(estado.pendienteCierre.diferencia * 100) === 0
                  ? "El conteo cuadró con el sistema."
                  : `${
                      estado.pendienteCierre.diferencia > 0
                        ? "Sobran "
                        : "Faltan "
                    }${soles(Math.abs(estado.pendienteCierre.diferencia))}.`}{" "}
                Hasta que el administrador lo autorice no puedes abrir una caja
                nueva.
              </p>
            </div>
          )}

          {/* Nada pendiente: se puede pedir la apertura */}
          {!esperando && (
            <>
              {estado.aperturaRechazada && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm">
                  <p className="font-bold text-white flex items-center gap-2">
                    <XCircle className="w-4 h-4 shrink-0" />
                    El administrador rechazó tu apertura
                  </p>

                  {estado.aperturaRechazada.motivo && (
                    <p className="mt-1.5 text-rose-200">
                      Motivo: {estado.aperturaRechazada.motivo}
                    </p>
                  )}

                  <p className="mt-1 text-rose-200">
                    Puedes volver a pedirla con el fondo corregido.
                  </p>
                </div>
              )}

              <label className="block">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Fondo inicial
                </span>

                <input
                  value={monto}
                  onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  autoFocus
                  className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-slate-100 outline-none focus:border-amber-400"
                />
              </label>

              <button
                type="button"
                onClick={solicitar}
                disabled={enviando || monto === ""}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 px-5 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
              >
                {enviando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LockOpen className="w-4 h-4" />
                )}
                Solicitar apertura al administrador
              </button>
            </>
          )}

          {/* El portón tapa la barra superior, así que la salida va acá: sin
              esto no habría forma de cambiar de cuenta con la caja cerrada. */}
          <button
            type="button"
            onClick={salir}
            disabled={saliendo}
            className="w-full text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1.5 pt-1 transition disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
