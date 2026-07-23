"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  Search,
  ShieldOff,
} from "lucide-react";

type Tramite = {
  id: string;
  number: string;
  status: string;
  establishmentAddress: string | null;
  business: { ruc: string; legalName: string; commercialAddress: string | null };
  license: {
    licenseNumber: string;
    issuedAt: string;
    expiresAt: string;
    status: string;
  } | null;
  puedeDarseDeBaja: boolean;
};

const ESTADOS_LICENCIA: Record<string, string> = {
  ACTIVE: "Vigente",
  RENEWAL_AVAILABLE: "Por vencer",
  EXPIRED: "Vencida",
  CANCELLED: "Dada de baja",
};

/** Mismo mínimo que exige el servidor. */
const MIN_MOTIVO = 10;

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-PE");

export default function BajaLicencia() {
  const [ruc, setRuc] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [consultado, setConsultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Un RUC puede tener varias licencias, una por local: se listan todas y el
  // cajero elige cuál dar de baja.
  const [tramites, setTramites] = useState<Tramite[]>([]);

  // La licencia cuya baja se está gestionando (su formulario abierto).
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  const [motivo, setMotivo] = useState("");
  const [dandoDeBaja, setDandoDeBaja] = useState(false);

  // Llave de la baja: el DNI del representante del trámite. Lo dicta el
  // contribuyente en el mostrador y el cajero lo transcribe; la pantalla **no
  // lo muestra**, porque mostrarlo sería regalar la llave.
  const [dni, setDni] = useState("");

  /** Trae las licencias del RUC. No toca los mensajes de éxito/error. */
  const cargar = async (limpio: string) => {
    const response = await fetch(`/api/cajero/baja-licencia?ruc=${limpio}`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setTramites(data.tramites || []);
  };

  const buscar = async () => {
    const limpio = ruc.replace(/\D/g, "");

    if (limpio.length !== 11) {
      setError("El RUC debe tener 11 dígitos.");
      return;
    }

    setConsultando(true);
    setError(null);
    setExito(null);
    setTramites([]);
    setSeleccionado(null);
    setMotivo("");
    setDni("");

    try {
      await cargar(limpio);
      setConsultado(limpio);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConsultando(false);
    }
  };

  const abrirFormulario = (id: string) => {
    setSeleccionado(id);
    setMotivo("");
    setDni("");
    setError(null);
    setExito(null);
  };

  const darDeBaja = async (applicationId: string) => {
    setDandoDeBaja(true);
    setError(null);

    try {
      const response = await fetch("/api/cajero/baja-licencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, motivo, dni }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setExito(data.message);
      setSeleccionado(null);
      setMotivo("");
      setDni("");
      // Se recarga la lista: la que se dio de baja pasa a figurar como tal.
      if (consultado) await cargar(consultado);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDandoDeBaja(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Búsqueda */}
      <section className="rounded-2xl border border-slate-850 bg-slate-900/40 p-6 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">
          Buscar licencias del RUC
        </h2>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={ruc}
            onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            placeholder="RUC del negocio (11 dígitos)"
            inputMode="numeric"
            className="flex-1 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 font-mono text-slate-100 outline-none focus:border-amber-400"
          />

          <button
            type="button"
            onClick={buscar}
            disabled={consultando}
            className="flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {consultando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Buscar
          </button>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {exito && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{exito}</span>
        </div>
      )}

      {consultado && tramites.length === 0 && (
        <div className="rounded-2xl border border-slate-850 bg-slate-900/40 p-6 text-sm text-slate-400">
          El RUC {consultado} no tiene ninguna licencia emitida.
        </div>
      )}

      {tramites.length > 0 && (
        <p className="text-xs text-slate-500">
          {tramites.length === 1
            ? "1 licencia."
            : `${tramites.length} licencias · una por local. Elige cuál dar de baja.`}
        </p>
      )}

      {tramites.map((tramite) => (
        <section
          key={tramite.id}
          className="rounded-2xl border border-slate-850 bg-slate-900/40 p-6 space-y-5"
        >
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              {tramite.business.legalName}
            </h2>
            <p className="mt-1 font-mono text-xs text-slate-500">
              RUC {tramite.business.ruc} · Trámite {tramite.number}
            </p>
            <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-400">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {tramite.establishmentAddress ||
                tramite.business.commercialAddress ||
                "Dirección no registrada"}
            </p>
          </div>

          {tramite.license && (
            <div className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Licencia
                </p>
                <p className="mt-1 font-mono text-sm text-slate-200">
                  {tramite.license.licenseNumber}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Vigencia
                </p>
                <p className="mt-1 text-sm text-slate-200">
                  {fecha(tramite.license.issuedAt)} —{" "}
                  {fecha(tramite.license.expiresAt)}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Estado
                </p>
                <p className="mt-1 text-sm font-bold text-amber-300">
                  {ESTADOS_LICENCIA[tramite.license.status] ??
                    tramite.license.status}
                </p>
              </div>
            </div>
          )}

          {!tramite.puedeDarseDeBaja ? (
            <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Esta licencia ya fue dada de baja. El local está libre para
                iniciar un trámite nuevo.
              </span>
            </div>
          ) : seleccionado !== tramite.id ? (
            <button
              type="button"
              onClick={() => abrirFormulario(tramite.id)}
              className="flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-400"
            >
              <ShieldOff className="h-4 w-4" />
              Dar de baja esta licencia
            </button>
          ) : (
            <>
              {/* Lo que la baja implica, dicho antes de hacerla: es
                  irreversible y libera el local. */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-100">
                <p className="font-bold text-white">Qué pasa al dar de baja</p>

                <ul className="mt-2 space-y-1 text-amber-200/90">
                  <li>· La licencia termina y no se puede reactivar.</li>
                  <li>· El local queda libre para iniciar un trámite nuevo.</li>
                  <li>· Se cancela cualquier inspección que estuviera agendada.</li>
                  <li>· No se cobra nada.</li>
                  <li>· Solo puede pedirla el titular, con su DNI.</li>
                </ul>
              </div>

              {/* La llave. Va antes del motivo porque es lo que habilita la
                  operación: sin el DNI del titular no hay baja posible. */}
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  DNI del representante legal
                </span>

                <input
                  value={dni}
                  onChange={(e) =>
                    setDni(e.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  inputMode="numeric"
                  placeholder="8 dígitos"
                  className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 font-mono text-slate-100 outline-none focus:border-amber-400"
                />

                <span className="mt-1 block text-xs text-slate-500">
                  Tiene que coincidir con el del trámite. Pídeselo al
                  contribuyente: es lo que acredita que la baja la pide el
                  titular.
                </span>
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Motivo de la baja
                </span>

                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  placeholder="Ej. El negocio se muda a un local nuevo en otra dirección."
                  className="mt-1.5 w-full resize-none rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-slate-100 outline-none focus:border-amber-400"
                />

                {/* No se menciona ningún correo: la baja no manda aviso, porque
                    el titular la está pidiendo en el mostrador. */}
                <span className="mt-1 block text-xs text-slate-500">
                  Mínimo {MIN_MOTIVO} caracteres. Queda registrado en la
                  auditoría.
                </span>
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => darDeBaja(tramite.id)}
                  disabled={
                    dandoDeBaja ||
                    dni.length !== 8 ||
                    motivo.trim().length < MIN_MOTIVO
                  }
                  className="flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {dandoDeBaja ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldOff className="h-4 w-4" />
                  )}
                  Confirmar baja
                </button>

                <button
                  type="button"
                  onClick={() => setSeleccionado(null)}
                  disabled={dandoDeBaja}
                  className="rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
