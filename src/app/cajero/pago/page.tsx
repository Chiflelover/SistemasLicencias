"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  DollarSign,
  FileText,
  Loader2,
  Smartphone,
} from "lucide-react";

const MONTO_TUPA = 180.0;

/** Billete de mayor denominación en Perú: nadie puede entregar más que esto. */
const BILLETE_MAXIMO = 200.0;

const METODOS = [
  { value: "EFECTIVO", label: "Efectivo", icon: Banknote },
  { value: "TARJETA", label: "Tarjeta", icon: CreditCard },
  { value: "YAPE", label: "Yape", icon: Smartphone },
  { value: "PLIN", label: "Plin", icon: Smartphone },
];

interface ApplicationRow {
  id: string;
  number: string;
  status: string;
  business: { legalName: string; ruc: string };
  documents: Array<{ id: string; type: string }>;
  payments: Array<{ id: string; operationNumber: string }>;
}

interface Comprobante {
  id: string;
  receiptType: "FACTURA" | "BOLETA";
  operationNumber: string;
  amount: number;
  method: string;
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
  const [recibido, setRecibido] = useState<string>(String(MONTO_TUPA));
  const [comprobanteTipo, setComprobanteTipo] = useState<"FACTURA" | "BOLETA">(
    "FACTURA"
  );
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
          method: metodo,
          receivedAmount: metodo === "EFECTIVO" ? Number(recibido) : undefined,
          receiptType: comprobanteTipo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo registrar el pago.");
      }

      setComprobante({
        id: data.payment.id,
        receiptType: data.payment.receiptType,
        operationNumber: data.payment.operationNumber,
        amount: data.payment.amount,
        method: data.payment.method,
        paidAt: data.payment.paidAt,
        applicationNumber: seleccionado.number,
        receivedAmount: data.payment.receivedAmount,
        changeGiven: data.payment.changeGiven,
      });

      setRecibido(String(MONTO_TUPA));
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

  const cobrables = applications.filter(
    (a) => a.status === "PENDING_PAYMENT" || a.status === "RENEWAL_AVAILABLE"
  );

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
                Monto
              </p>
              <p className="text-white font-bold">
                S/ {comprobante.amount.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-emerald-500/70 text-xs uppercase tracking-wider font-bold">
                Método
              </p>
              <p className="text-white">{comprobante.method}</p>
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
            Descargar {comprobante.receiptType === "BOLETA" ? "boleta" : "factura"}
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
              S/ {MONTO_TUPA.toFixed(2)}
            </span>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">
              Método de pago
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {METODOS.map((m) => {
                const Icono = m.icon;
                const activo = metodo === m.value;

                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMetodo(m.value)}
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

          <div>
            <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">
              Comprobante a emitir
            </p>

            <div className="grid grid-cols-2 gap-3">
              {(["FACTURA", "BOLETA"] as const).map((tipo) => {
                const activo = comprobanteTipo === tipo;

                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setComprobanteTipo(tipo)}
                    className={`py-3 px-3 rounded-xl text-sm font-bold flex flex-col items-center gap-1 border transition ${
                      activo
                        ? "bg-amber-500 text-slate-950 border-amber-400"
                        : "bg-slate-950/50 text-slate-300 border-slate-800 hover:border-slate-600"
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                    {tipo === "FACTURA" ? "Factura" : "Boleta"}
                    <span
                      className={`text-[10px] font-normal ${
                        activo ? "text-slate-800" : "text-slate-500"
                      }`}
                    >
                      {tipo === "FACTURA" ? "Serie F001 · RUC" : "Serie B001 · DNI"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* El titular siempre tiene RUC, así que la factura es lo que
                corresponde salvo que el contribuyente pida boleta. */}
            {comprobanteTipo === "BOLETA" && (
              <p className="mt-2 text-xs text-amber-300/80">
                La boleta se emite al representante legal. Si el trámite se
                inició por la web y no se relevó su DNI, sale como consumidor
                final.
              </p>
            )}
          </div>

          {/* El vuelto solo aplica en efectivo: los medios digitales cobran
              el importe exacto. */}
          {metodo === "EFECTIVO" && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
              <label className="block">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
                  Con cuánto paga
                </span>

                <input
                  value={recibido}
                  onChange={(e) =>
                    setRecibido(e.target.value.replace(/[^\d.]/g, ""))
                  }
                  inputMode="decimal"
                  className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-slate-100 outline-none focus:border-amber-400"
                />

                <span className="mt-1.5 block text-xs text-slate-500">
                  Entre S/ {MONTO_TUPA.toFixed(2)} y S/{" "}
                  {BILLETE_MAXIMO.toFixed(2)}, el billete más grande que existe.
                </span>
              </label>

              {recibido !== "" && Number(recibido) >= MONTO_TUPA && (
                <div className="flex items-center justify-between rounded-lg bg-slate-900/60 px-4 py-3">
                  <span className="text-sm text-slate-400">Vuelto a devolver</span>
                  <span className="text-xl font-black text-emerald-400">
                    S/ {(Number(recibido) - MONTO_TUPA).toFixed(2)}
                  </span>
                </div>
              )}

              {recibido !== "" && Number(recibido) < MONTO_TUPA && (
                <p className="text-sm font-semibold text-rose-300">
                  No alcanza para cubrir la tasa.
                </p>
              )}

              {Number(recibido) > BILLETE_MAXIMO && (
                <p className="text-sm font-semibold text-rose-300">
                  No puede superar los S/ {BILLETE_MAXIMO.toFixed(2)}.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={confirmarCobro}
              disabled={
                cobrando ||
                (metodo === "EFECTIVO" &&
                  (recibido === "" ||
                    Number(recibido) < MONTO_TUPA ||
                    Number(recibido) > BILLETE_MAXIMO))
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
            Solo los que registraste vos y ya tienen la documentación completa.
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
                    <DollarSign className="w-4 h-4" />
                    Cobrar S/ {MONTO_TUPA.toFixed(2)}
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
