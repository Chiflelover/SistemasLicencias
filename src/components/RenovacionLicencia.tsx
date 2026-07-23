"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileUp,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
} from "lucide-react";

type Tramite = {
  id: string;
  number: string;
  status: string;
  establishmentAddress: string | null;
  business: { ruc: string; legalName: string };
  documents: Array<{ id: string; type: string; name: string }>;
  license: {
    licenseNumber: string;
    issuedAt: string;
    expiresAt: string;
    status: string;
  } | null;
  renovable: boolean;
};

const ETIQUETAS: Record<string, string> = {
  LICENSE_ISSUED: "Licencia vigente",
  RENEWAL_AVAILABLE: "Licencia por vencer",
  EXPIRED: "Licencia vencida",
  CANCELLED: "Licencia dada de baja",
};

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export default function RenovacionLicencia() {
  const [ruc, setRuc] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consultado, setConsultado] = useState<string | null>(null);

  // Un RUC puede tener varias licencias, una por local: se listan todas y el
  // cajero elige cuál renovar (solo las vencidas son renovables).
  const [tramites, setTramites] = useState<Tramite[]>([]);

  // Trámite cuyo formulario de documentos está abierto (uno a la vez). Los
  // documentos de la renovación son opcionales: solo si cambió algo del local.
  const [docsTramite, setDocsTramite] = useState<string | null>(null);
  const [plano, setPlano] = useState<File | null>(null);
  const [fichaRuc, setFichaRuc] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  const [exitoSubida, setExitoSubida] = useState<string | null>(null);

  const cerrarDocs = () => {
    setDocsTramite(null);
    setPlano(null);
    setFichaRuc(null);
    setErrorSubida(null);
    setExitoSubida(null);
  };

  const consultar = async () => {
    if (ruc.length !== 11) {
      setError("El RUC debe tener 11 dígitos.");
      return;
    }

    setConsultando(true);
    setError(null);
    setTramites([]);
    cerrarDocs();

    try {
      const response = await fetch(
        `/api/cajero/renovacion?ruc=${encodeURIComponent(ruc)}`,
        { cache: "no-store" }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No se pudo consultar el RUC.");
      }

      setTramites(data.tramites || []);
      setConsultado(ruc);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConsultando(false);
    }
  };

  const subirDocumentos = async (tramiteId: string) => {
    setSubiendo(true);
    setErrorSubida(null);
    setExitoSubida(null);

    try {
      const formData = new FormData();
      if (plano) formData.append("plano", plano);
      if (fichaRuc) formData.append("fichaRuc", fichaRuc);

      const response = await fetch(
        `/api/cajero/renovacion/${tramiteId}/documentos`,
        { method: "POST", body: formData }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setExitoSubida(data.message);
      setPlano(null);
      setFichaRuc(null);
    } catch (err: any) {
      setErrorSubida(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  const hayArchivo = Boolean(plano || fichaRuc);

  return (
    <div className="rounded-2xl border border-slate-850 bg-slate-900/40 overflow-hidden">
      <div className="p-5 border-b border-slate-850">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-amber-400" />
          <h2 className="text-lg font-bold text-white">
            Renovación de licencia
          </h2>
        </div>

        <p className="mt-1 text-sm text-slate-400">
          La renovación se hace acá, después de que la licencia venció. Un RUC
          puede tener varias licencias, una por local: elige cuál renovar. Si el
          local cambió puedes registrar los documentos actualizados; si no
          cambió nada, pasas directo al cobro.
        </p>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={ruc}
            onChange={(e) => {
              setRuc(e.target.value.replace(/\D/g, "").slice(0, 11));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") consultar();
            }}
            inputMode="numeric"
            placeholder="RUC del negocio (11 dígitos)"
            className="flex-1 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-slate-100 outline-none focus:border-amber-400"
          />

          <button
            type="button"
            onClick={consultar}
            disabled={ruc.length !== 11 || consultando}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
          >
            {consultando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Consultar
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {consultado && tramites.length === 0 && (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
            El RUC {consultado} no tiene ninguna licencia emitida. Si es un
            negocio nuevo, usa <strong>Registro presencial</strong>.
          </div>
        )}

        {tramites.length > 1 && (
          <p className="text-xs text-slate-500">
            {tramites.length} licencias · una por local.
          </p>
        )}

        {tramites.map((tramite) => (
          <div
            key={tramite.id}
            className={`rounded-xl border p-4 text-sm ${
              tramite.renovable
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-slate-800 bg-slate-950/60"
            }`}
          >
            <p className="font-bold text-white">{tramite.business.legalName}</p>

            <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-400">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {tramite.establishmentAddress || "Dirección no registrada"}
            </p>

            <p className="mt-1 text-slate-300">
              Trámite {tramite.number} ·{" "}
              <span className={tramite.renovable ? "text-amber-200" : ""}>
                {ETIQUETAS[tramite.status] ?? tramite.status}
              </span>
            </p>

            {tramite.license && (
              <p className="mt-1 text-slate-400">
                Licencia {tramite.license.licenseNumber},{" "}
                {tramite.renovable ? "venció" : "vigente hasta"} el{" "}
                {fecha(tramite.license.expiresAt)}.
              </p>
            )}

            {!tramite.renovable ? (
              <p className="mt-2 text-amber-200/80">
                La renovación se habilita recién cuando la licencia vence.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {/* Paso 1 · Documentos actualizados (opcional) */}
                {docsTramite === tramite.id ? (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                    <p className="text-sm font-bold text-white">
                      Documentos actualizados{" "}
                      <span className="font-normal text-slate-500">
                        (opcional)
                      </span>
                    </p>

                    {exitoSubida ? (
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{exitoSubida}</span>
                      </div>
                    ) : (
                      <>
                        <label className="block">
                          <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                            Plano del local
                          </span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) =>
                              setPlano(e.target.files?.[0] ?? null)
                            }
                            className="mt-1.5 w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                            Ficha RUC
                          </span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) =>
                              setFichaRuc(e.target.files?.[0] ?? null)
                            }
                            className="mt-1.5 w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200"
                          />
                        </label>

                        {/* El "5MB" va a mano: si cambia el límite del servidor
                            hay que corregir este texto. */}
                        <p className="text-xs text-slate-500">
                          PDF, JPG o PNG. Máximo 5MB por archivo.
                        </p>

                        {errorSubida && (
                          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{errorSubida}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => subirDocumentos(tramite.id)}
                            disabled={subiendo || !hayArchivo}
                            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-bold text-white transition"
                          >
                            {subiendo ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <FileUp className="w-4 h-4" />
                            )}
                            Registrar documentos
                          </button>

                          <button
                            type="button"
                            onClick={cerrarDocs}
                            className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
                          >
                            Cerrar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      cerrarDocs();
                      setDocsTramite(tramite.id);
                    }}
                    className="text-xs font-semibold text-slate-300 underline underline-offset-2 hover:text-white"
                  >
                    ¿Cambió algo del local? Registrar documentos actualizados
                    (opcional)
                  </button>
                )}

                {/* Paso 2 · Cobrar. La lista de cobro ya trae las licencias
                    vencidas; el cajero elige este local ahí. */}
                <Link
                  href="/cajero/pago"
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition"
                >
                  Ir al cobro de la renovación
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
