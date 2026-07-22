"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DocumentosDelTramite from "@/components/DocumentosDelTramite";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  DollarSign,
  FileText,
  Loader2,
  Receipt,
  Smartphone,
} from "lucide-react";

/**
 * Tarifa de arranque, hasta que responde /api/tarifa.
 *
 * La fija el administrador y puede no ser 180: esto es solo el valor con el
 * que se pinta la pantalla el primer instante. El servidor valida contra la
 * tarifa real, así que un desfase acá no deja pasar un cobro incorrecto.
 */
const TARIFA_POR_DEFECTO = 180.0;

/** La ventanilla solo cobra en efectivo o por Yape. */
const METODOS = [
  { value: "EFECTIVO", label: "Efectivo", icon: Banknote },
  { value: "YAPE", label: "Yape", icon: Smartphone },
];

interface ApplicationRow {
  id: string;
  number: string;
  status: string;
  business: { legalName: string; ruc: string };
  documents: Array<{ id: string; type: string; name: string }>;
  payments: Array<{ id: string; operationNumber: string }>;
}

interface Comprobante {
  id: string;
  operationNumber: string;
  total: number;
  formasPago: Array<{ method: string; amount: number; operacion?: string | null }>;
  paidAt: string;
  applicationNumber: string;
  receivedAmount: number | null;
  changeGiven: number | null;
}

export default function CajeroPagoPage() {
  const router = useRouter();

  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionado, setSeleccionado] = useState<ApplicationRow | null>(null);
  const [metodo, setMetodo] = useState<string>("EFECTIVO");
  const [recibido, setRecibido] = useState<string>(String(TARIFA_POR_DEFECTO));

  // Tarifa vigente, que fija el administrador.
  const [tarifa, setTarifa] = useState<number>(TARIFA_POR_DEFECTO);

  /**
   * Cómo se compone el cobro.
   *
   * - `simple`: un solo medio por el importe completo.
   * - `mixto`: dos medios distintos cuyos montos suman la tasa.
   * - `yape-multiple`: dos transferencias de Yape, cada una con su código.
   *
   * Los dos últimos comparten toda la mecánica —dos tramos que suman exacto y
   * sin vuelto—, así que se tratan igual salvo por qué medios admiten.
   */
  const [modo, setModo] = useState<"simple" | "mixto" | "yape-multiple">("simple");
  const mixto = modo !== "simple";

  const [metodo2, setMetodo2] = useState<string>("YAPE");
  const [monto1, setMonto1] = useState<string>(String(TARIFA_POR_DEFECTO / 2));
  const [monto2, setMonto2] = useState<string>(String(TARIFA_POR_DEFECTO / 2));

  // Código que muestra la app del contribuyente. Obligatorio en cada tramo por
  // Yape: es lo único que permite conciliar el cobro contra la cuenta.
  const [operacion1, setOperacion1] = useState("");
  const [operacion2, setOperacion2] = useState("");

  const elegirModo = (nuevo: "simple" | "mixto" | "yape-multiple") => {
    setModo(nuevo);

    // Yape múltiple es, por definición, Yape en los dos tramos.
    if (nuevo === "yape-multiple") {
      setMetodo("YAPE");
      setMetodo2("YAPE");
    }
  };

  // Al llegar la tarifa real se reacomodan los montos propuestos: si no, el
  // mixto arrancaría con una suma que no da y el cajero tendría que corregir
  // dos campos antes de poder cobrar.
  useEffect(() => {
    fetch("/api/tarifa", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const monto = Number(data.amount);
        if (!Number.isFinite(monto) || monto <= 0) return;

        setTarifa(monto);
        setRecibido(String(monto));

        const mitad = Math.round((monto / 2) * 100) / 100;
        setMonto1(String(mitad));
        setMonto2(String(Math.round((monto - mitad) * 100) / 100));
      })
      .catch(() => {
        // Se queda con la tarifa por defecto: el servidor valida igual.
      });
  }, []);

  // Sin caja abierta el cobro se rechaza en el servidor. Se consulta acá para
  // avisarlo antes y no que el cajero lo descubra al confirmar.
  const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null);

  // Efectivo del cajón: con eso se paga el vuelto, así que acota cuánto se
  // puede devolver. El servidor lo valida igual; esto es para avisar antes.
  const [efectivoEnCaja, setEfectivoEnCaja] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/cajero/caja", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setCajaAbierta(Boolean(data.abierta));
        setEfectivoEnCaja(
          typeof data.totales?.esperadoEnCaja === "number"
            ? data.totales.esperadoEnCaja
            : null
        );
      })
      .catch(() => setCajaAbierta(null));
  }, []);
  const [cobrando, setCobrando] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [comprobante, setComprobante] = useState<Comprobante | null>(null);

  const cargarSolicitudes = async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/cajero/solicitudes", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudieron cargar las solicitudes.");
      }

      setApplications(data.applications || []);
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarSolicitudes();
  }, []);

  const confirmarCobro = async () => {
    if (!seleccionado) return;

    setCobrando(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/cajero/pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: seleccionado.id,
          formasPago: tramos,
          receivedAmount:
            !mixto && metodo === "EFECTIVO" ? Number(recibido) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo registrar el pago.");
      }

      setComprobante({
        id: data.payment.id,
        operationNumber: data.payment.operationNumber,
        total: data.payment.total,
        formasPago: data.payment.formasPago,
        paidAt: data.payment.paidAt,
        applicationNumber: seleccionado.number,
        receivedAmount: data.payment.receivedAmount,
        changeGiven: data.payment.changeGiven,
      });

      setRecibido(String(tarifa));
      setSeleccionado(null);
      setMetodo("EFECTIVO");

      await cargarSolicitudes();
      router.refresh();
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setCobrando(false);
    }
  };

  // EXPIRED es la renovación: se cobra recién cuando la licencia venció.
  const cobrables = applications.filter(
    (a) => a.status === "PENDING_PAYMENT" || a.status === "EXPIRED"
  );

  // Vuelto del pago en efectivo, y si el cajón tiene con qué pagarlo.
  const vuelto = Math.max(0, Number(recibido) - tarifa);
  const vueltoSinFondo =
    !mixto &&
    metodo === "EFECTIVO" &&
    recibido !== "" &&
    Number(recibido) >= tarifa &&
    vuelto > 0 &&
    efectivoEnCaja !== null &&
    Math.round(vuelto * 100) > Math.round(efectivoEnCaja * 100);

  /**
   * Los tramos del cobro, tal como van a viajar al servidor.
   *
   * Se arman una sola vez y de acá salen todas las validaciones: así lo que se
   * comprueba en pantalla y lo que se manda no pueden desincronizarse.
   */
  const tramos = mixto
    ? [
        { method: metodo, amount: Number(monto1) || 0, operacion: operacion1 },
        { method: metodo2, amount: Number(monto2) || 0, operacion: operacion2 },
      ]
    : [{ method: metodo, amount: tarifa, operacion: operacion1 }];

  // Validación del pago en dos tramos: la suma tiene que dar la tasa exacta.
  const sumaMixto = (Number(monto1) || 0) + (Number(monto2) || 0);
  const sumaMixtoOk = Math.round(sumaMixto * 100) === Math.round(tarifa * 100);

  // Repetir el medio solo vale para Yape: son dos transferencias distintas.
  // Dos tramos en efectivo serían un único pago partido sin motivo.
  const metodosCompatibles =
    metodo !== metodo2 || (metodo === "YAPE" && metodo2 === "YAPE");

  // Todo tramo por Yape necesita su código de operación, sea el pago simple,
  // mixto o múltiple.
  const faltaOperacionYape = tramos.some(
    (tramo) => tramo.method === "YAPE" && !tramo.operacion.trim()
  );

  const mixtoValido =
    metodosCompatibles &&
    sumaMixtoOk &&
    Number(monto1) > 0 &&
    Number(monto2) > 0;

  const formatearFechaHora = (iso: string) => {
    const fecha = new Date(iso);
    return {
      fecha: fecha.toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      hora: fecha.toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/cajero"
            className="text-sm text-slate-400 hover:text-white inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al panel
          </Link>

          <h1 className="mt-4 text-2xl font-bold text-white">
            Registrar pago en caja
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Confirma el cobro recibido en ventanilla. No interviene ninguna
            pasarela de pago.
          </p>
        </div>

        <Link
          href="/cajero/arqueo"
          className="border border-slate-700 hover:border-slate-500 text-slate-200 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition"
        >
          Ver arqueo
        </Link>
      </div>

      {cajaAbierta === false && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Tienes la caja cerrada, así que no podrás registrar cobros.{" "}
            <Link
              href="/cajero/arqueo"
              className="font-bold underline underline-offset-2 hover:text-amber-100"
            >
              Ábrela desde Arqueo de caja
            </Link>
            .
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {comprobante && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
          <div className="flex items-center gap-2 text-emerald-300 font-bold">
            <CheckCircle2 className="w-5 h-5" />
            Pago registrado
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-emerald-500/70 text-xs uppercase tracking-wider font-bold">
                N° de operación
              </p>
              <p className="text-white font-mono">{comprobante.operationNumber}</p>
            </div>
            <div>
              <p className="text-emerald-500/70 text-xs uppercase tracking-wider font-bold">
                Trámite
              </p>
              <p className="text-white font-mono">{comprobante.applicationNumber}</p>
            </div>
            <div>
              <p className="text-emerald-500/70 text-xs uppercase tracking-wider font-bold">
                Monto total
              </p>
              <p className="text-white font-bold">
                S/ {comprobante.total.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-emerald-500/70 text-xs uppercase tracking-wider font-bold">
                {comprobante.formasPago.length > 1 ? "Medios de pago" : "Medio"}
              </p>
              {comprobante.formasPago.length > 1 ? (
                <div className="space-y-0.5">
                  {comprobante.formasPago.map((f, i) => (
                    <p key={i} className="text-white text-sm">
                      {f.method} · S/ {f.amount.toFixed(2)}
                      {/* Con dos Yapes el monto no alcanza para distinguirlos:
                          el código de operación es lo único que los separa. */}
                      {f.operacion && (
                        <span className="text-emerald-200/70"> · Op. {f.operacion}</span>
                      )}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-white">
                  {comprobante.formasPago[0]?.method}
                  {comprobante.formasPago[0]?.operacion && (
                    <span className="text-emerald-200/70">
                      {" "}
                      · Op. {comprobante.formasPago[0].operacion}
                    </span>
                  )}
                </p>
              )}
            </div>
            <div>
              <p className="text-emerald-500/70 text-xs uppercase tracking-wider font-bold">
                Fecha
              </p>
              <p className="text-white">
                {formatearFechaHora(comprobante.paidAt).fecha}
              </p>
            </div>
            <div>
              <p className="text-emerald-500/70 text-xs uppercase tracking-wider font-bold">
                Hora
              </p>
              <p className="text-white font-mono">
                {formatearFechaHora(comprobante.paidAt).hora}
              </p>
            </div>

            {/* Solo en efectivo: en los demás métodos no hay vuelto. */}
            {comprobante.receivedAmount !== null && (
              <>
                <div>
                  <p className="text-emerald-500/70 text-xs uppercase tracking-wider font-bold">
                    Pagó con
                  </p>
                  <p className="text-white font-bold">
                    S/ {comprobante.receivedAmount.toFixed(2)}
                  </p>
                </div>

                <div>
                  <p className="text-emerald-500/70 text-xs uppercase tracking-wider font-bold">
                    Vuelto entregado
                  </p>
                  <p className="text-white font-bold">
                    S/ {(comprobante.changeGiven ?? 0).toFixed(2)}
                  </p>
                </div>
              </>
            )}
          </div>

          <p className="mt-4 text-xs text-emerald-400/80">
            El trámite quedó en estado PAGADO y la inspección fue agendada.
          </p>

          <a
            href={`/api/cajero/pago/${comprobante.id}/comprobante`}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2.5 text-sm font-bold transition"
          >
            <FileText className="w-4 h-4" />
            Descargar factura
          </a>

          {/* El documento que en la realidad entrega una municipalidad por una
              tasa: el derecho de trámite no obliga a emitir comprobante de pago
              (ver src/lib/receipt.ts). Va en segundo plano y no escondido: la
              factura es la principal, como se pidió, pero el sistema emite las
              dos y eso conviene que se vea. */}
          <a
            href={`/api/cajero/pago/${comprobante.id}/recibo`}
            className="mt-3 flex items-center gap-1.5 text-xs text-emerald-300/60 hover:text-emerald-200 transition"
          >
            <Receipt className="h-3.5 w-3.5" />
            Descargar recibo de caja
          </a>
        </div>
      )}

      {seleccionado && (
        <div className="rounded-2xl border border-amber-500/40 bg-slate-900/60 p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-white">Confirmar cobro</h2>
            <p className="text-sm text-slate-400 mt-1">
              {seleccionado.business.legalName} · {seleccionado.number}
            </p>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
              Monto a cobrar
            </span>
            <span className="text-3xl font-black text-amber-300">
              S/ {tarifa.toFixed(2)}
            </span>
          </div>

          {/* Cómo se compone el cobro. Yape múltiple va como opción propia y
              no escondida dentro del mixto: es el caso que el cajero busca por
              su nombre cuando el contribuyente pagó en dos transferencias. */}
          <div>
            <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">
              Forma de cobro
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["simple", "Pago simple", "Un solo medio"],
                  ["mixto", "Pago mixto", "2 medios distintos"],
                  ["yape-multiple", "Yape Múltiple", "2 operaciones de Yape"],
                ] as const
              ).map(([valor, titulo, detalle]) => {
                const activo = modo === valor;

                return (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => elegirModo(valor)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      activo
                        ? "border-amber-400 bg-amber-500/10"
                        : "border-slate-800 bg-slate-950/50 hover:border-slate-600"
                    }`}
                  >
                    <span
                      className={`block text-sm font-bold ${
                        activo ? "text-amber-300" : "text-slate-200"
                      }`}
                    >
                      {titulo}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {detalle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider font-bold text-slate-500">
                {mixto ? "Medio 1" : "Medio de pago"}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {METODOS.map((m) => {
                const Icono = m.icon;
                const activo = metodo === m.value;
                // En Yape múltiple los dos tramos son Yape por definición.
                const bloqueado = modo === "yape-multiple";

                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMetodo(m.value)}
                    disabled={bloqueado}
                    className={`py-3 px-3 rounded-xl text-sm font-bold flex flex-col items-center gap-2 border transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      activo
                        ? "bg-amber-500 text-slate-950 border-amber-400"
                        : "bg-slate-950/50 text-slate-300 border-slate-800 hover:border-slate-600"
                    }`}
                  >
                    <Icono className="w-5 h-5" />
                    {m.label}
                  </button>
                );
              })}
            </div>

            {/* Yape simple: el código va acá, fuera del bloque del mixto. */}
            {!mixto && metodo === "YAPE" && (
              <label className="mt-4 block">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
                  N° de operación del Yape
                </span>
                <input
                  value={operacion1}
                  onChange={(e) => setOperacion1(e.target.value)}
                  placeholder="El código que muestra la app"
                  className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 font-mono text-slate-100 outline-none focus:border-amber-400"
                />
              </label>
            )}

            {/* Pago mixto: monto del método 1, luego el método 2 y su monto.
                Los dos deben sumar la tasa exacta; no hay vuelto. */}
            {mixto && (
              <div className="mt-4 space-y-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <label className="block">
                  <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
                    {modo === "yape-multiple"
                      ? "Monto del Yape 1"
                      : `Monto en ${metodo.toLowerCase()}`}
                  </span>
                  <input
                    value={monto1}
                    onChange={(e) =>
                      setMonto1(e.target.value.replace(/[^\d.]/g, ""))
                    }
                    inputMode="decimal"
                    className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-slate-100 outline-none focus:border-amber-400"
                  />
                </label>

                {metodo === "YAPE" && (
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
                      N° de operación del Yape {modo === "yape-multiple" ? "1" : ""}
                    </span>
                    <input
                      value={operacion1}
                      onChange={(e) => setOperacion1(e.target.value)}
                      placeholder="El código que muestra la app"
                      className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 font-mono text-slate-100 outline-none focus:border-amber-400"
                    />
                  </label>
                )}

                {/* En Yape múltiple el medio 2 no se elige: ya está fijado. */}
                {modo === "mixto" && (
                  <div>
                    <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">
                      Medio 2
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {METODOS.map((m) => {
                        const Icono = m.icon;
                        const activo = metodo2 === m.value;
                        return (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setMetodo2(m.value)}
                            className={`py-3 px-3 rounded-xl text-sm font-bold flex flex-col items-center gap-2 border transition ${
                              activo
                                ? "bg-amber-500 text-slate-950 border-amber-400"
                                : "bg-slate-950/50 text-slate-300 border-slate-800 hover:border-slate-600"
                            }`}
                          >
                            <Icono className="w-5 h-5" />
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <label className="block">
                  <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
                    {modo === "yape-multiple"
                      ? "Monto del Yape 2"
                      : `Monto en ${metodo2.toLowerCase()}`}
                  </span>
                  <input
                    value={monto2}
                    onChange={(e) =>
                      setMonto2(e.target.value.replace(/[^\d.]/g, ""))
                    }
                    inputMode="decimal"
                    className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-slate-100 outline-none focus:border-amber-400"
                  />
                </label>

                {metodo2 === "YAPE" && (
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
                      N° de operación del Yape {modo === "yape-multiple" ? "2" : ""}
                    </span>
                    <input
                      value={operacion2}
                      onChange={(e) => setOperacion2(e.target.value)}
                      placeholder="El código que muestra la app"
                      className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 font-mono text-slate-100 outline-none focus:border-amber-400"
                    />
                  </label>
                )}

                <div className="flex items-center justify-between rounded-lg bg-slate-900/60 px-4 py-3">
                  <span className="text-sm text-slate-400">Suma</span>
                  <span
                    className={`text-lg font-black ${
                      sumaMixtoOk ? "text-emerald-400" : "text-rose-300"
                    }`}
                  >
                    S/ {sumaMixto.toFixed(2)} / {tarifa.toFixed(2)}
                  </span>
                </div>

                {!metodosCompatibles && (
                  <p className="text-sm font-semibold text-rose-300">
                    Los dos medios deben ser distintos. Solo Yape admite dos
                    operaciones.
                  </p>
                )}

                {/* El texto que pidió el profesor. El monto va interpolado
                    porque la tarifa la cambia el administrador: escribirlo a
                    mano lo volvería falso en cuanto la toque. */}
                {metodosCompatibles && !sumaMixtoOk && (
                  <p className="text-sm font-semibold text-rose-300">
                    Monto insuficiente o excedido. El total debe ser S/{" "}
                    {tarifa.toFixed(2)}.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* El comprobante ya no se elige: la municipalidad emite solo
              factura, así que no hay nada que preguntar acá. */}

          {/* El vuelto solo aplica en un pago único en efectivo: en mixto los
              montos son exactos, y los medios digitales cobran el importe. */}
          {!mixto && metodo === "EFECTIVO" && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
              <label className="block">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
                  Con cuánto paga
                </span>

                <input
                  value={recibido}
                  onChange={(e) =>
                    // Sin tope: el contribuyente puede entregar varios
                    // billetes y el vuelto es la diferencia exacta.
                    setRecibido(e.target.value.replace(/[^\d.]/g, ""))
                  }
                  inputMode="decimal"
                  className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-slate-100 outline-none focus:border-amber-400"
                />

                <span className="mt-1.5 block text-xs text-slate-500">
                  Desde S/ {tarifa.toFixed(2)}. El vuelto se calcula solo.
                </span>
              </label>

              {recibido !== "" && Number(recibido) >= tarifa && (
                <div
                  className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                    vueltoSinFondo ? "bg-rose-500/10" : "bg-slate-900/60"
                  }`}
                >
                  <span className="text-sm text-slate-400">Vuelto a devolver</span>
                  <span
                    className={`text-xl font-black ${
                      vueltoSinFondo ? "text-rose-300" : "text-emerald-400"
                    }`}
                  >
                    S/ {vuelto.toFixed(2)}
                  </span>
                </div>
              )}

              {/* El vuelto sale del cajón: si no alcanza, el cobro no puede
                  cerrarse aunque el monto recibido sea correcto. */}
              {vueltoSinFondo && (
                <p className="text-sm font-semibold text-rose-300">
                  En la caja hay S/ {efectivoEnCaja?.toFixed(2)}: no alcanza para
                  ese vuelto. Pide el importe justo o que el administrador
                  entregue efectivo.
                </p>
              )}

              {recibido !== "" && Number(recibido) < tarifa && (
                <p className="text-sm font-semibold text-rose-300">
                  No alcanza para cubrir la tasa.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={confirmarCobro}
              disabled={
                cobrando ||
                cajaAbierta === false ||
                // Sin el código de operación no se habilita el cobro, en
                // cualquiera de los tres modos.
                faltaOperacionYape ||
                (mixto
                  ? !mixtoValido
                  : metodo === "EFECTIVO" &&
                    (recibido === "" ||
                      Number(recibido) < tarifa ||
                      vueltoSinFondo))
              }
              className="flex-grow bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 px-5 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
            >
              {cobrando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Confirmar pago recibido
            </button>

            <button
              onClick={() => setSeleccionado(null)}
              disabled={cobrando}
              className="border border-slate-700 hover:border-slate-500 text-slate-300 px-5 py-3 rounded-lg text-sm font-bold transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-850 bg-slate-900/40 overflow-hidden">
        <div className="p-5 border-b border-slate-850">
          <h2 className="text-lg font-bold text-white">
            Trámites pendientes de cobro
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Los que tienes asignados y las licencias vencidas por renovar. Si el
            contribuyente empezó por la web, consulta su RUC en Registrar
            solicitud presencial para revisarlo y continuarlo.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-5 h-5 mx-auto animate-spin text-slate-500" />
          </div>
        ) : cobrables.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            <DollarSign className="w-8 h-8 mx-auto mb-3 opacity-40" />
            No hay trámites pendientes de cobro.
          </div>
        ) : (
          <div className="divide-y divide-slate-850">
            {cobrables.map((application) => {
              // ── PARA HACER LOS DOCUMENTOS OPCIONALES ────────────────────
              // Esto habilita el botón de cobrar. Según lo que pidan:
              //
              //   const tieneDocumentos = true;   // no exigir ninguno
              //   const tieneDocumentos =         // al menos uno de los dos
              //     application.documents.some((d) => d.type === "FLOOR_PLAN") ||
              //     application.documents.some((d) => d.type === "RUC_RECORD");
              //
              // Es solo la pantalla: el que rechaza de verdad es
              // src/services/cash.service.ts, y hay que aflojarlo igual.
              const tieneDocumentos =
                application.documents.some((d) => d.type === "FLOOR_PLAN") &&
                application.documents.some((d) => d.type === "RUC_RECORD");

              return (
                <div
                  key={application.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-mono text-amber-300 text-sm">
                      {application.number}
                    </p>
                    <p className="text-white font-semibold mt-0.5">
                      {application.business.legalName}
                    </p>
                    <p className="text-slate-500 text-xs font-mono mt-0.5">
                      RUC {application.business.ruc}
                    </p>

                    {!tieneDocumentos && (
                      <p className="text-amber-400 text-xs mt-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Faltan el plano del local o los certificados
                      </p>
                    )}

                    {/* El cajero abre los archivos y se los muestra al
                        contribuyente antes de cobrarle. En la renovación no va:
                        esos documentos tienen su propia pantalla. */}
                    {application.status === "PENDING_PAYMENT" && (
                      <DocumentosDelTramite
                        applicationId={application.id}
                        documentos={application.documents}
                        onReemplazado={cargarSolicitudes}
                      />
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSeleccionado(application);
                      setComprobante(null);
                      setErrorMessage(null);
                    }}
                    disabled={!tieneDocumentos}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition whitespace-nowrap"
                  >
                    <Banknote className="w-4 h-4" />
                    Cobrar S/ {tarifa.toFixed(2)}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
