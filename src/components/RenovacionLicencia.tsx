"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileUp,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";

type Tramite = {
  id: string;
  number: string;
  status: string;
  business: { ruc: string; legalName: string };
  documents: Array<{ id: string; type: string; name: string }>;
  license: {
    licenseNumber: string;
    issuedAt: string;
    expiresAt: string;
    status: string;
  } | null;
};

const ETIQUETAS: Record<string, string> = {
  DRAFT: "Borrador",
  DOCUMENTS_COMPLETE: "Documentos completos",
  PENDING_PAYMENT: "Pendiente de pago",
  PAYMENT_COMPLETED: "Pagado, esperando inspección",
  INSPECTION_SCHEDULED: "Inspección programada",
  FIRST_INSPECTION_REJECTED: "Observado",
  SECOND_INSPECTION_SCHEDULED: "Observado · 2da inspección programada",
  LICENSE_ISSUED: "Licencia vigente",
  RENEWAL_AVAILABLE: "Licencia por vencer",
  DEFINITIVELY_REJECTED: "Rechazado definitivo",
  EXPIRED: "Licencia vencida",
};

export default function RenovacionLicencia() {
  const [ruc, setRuc] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consultado, setConsultado] = useState<string | null>(null);
  const [tramite, setTramite] = useState<Tramite | null>(null);
  const [renovable, setRenovable] = useState(false);

  // Documentos actualizados: opcionales. Si el local no cambió, no se sube nada.
  const [plano, setPlano] = useState<File | null>(null);
  const [fichaRuc, setFichaRuc] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  const [exitoSubida, setExitoSubida] = useState<string | null>(null);

  const limpiar = () => {
    setTramite(null);
    setConsultado(null);
    setRenovable(false);
    setError(null);
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
    limpiar();

    try {
      const response = await fetch(
        `/api/cajero/renovacion?ruc=${encodeURIComponent(ruc)}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo consultar el RUC.");
      }

      setTramite(data.tramite);
      setRenovable(Boolean(data.renovable));
      setConsultado(ruc);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConsultando(false);
    }
  };

  const subirDocumentos = async () => {
    if (!tramite) return;

    setSubiendo(true);
    setErrorSubida(null);
    setExitoSubida(null);

    try {
      const formData = new FormData();
      if (plano) formData.append("plano", plano);
      if (fichaRuc) formData.append("fichaRuc", fichaRuc);

      const response = await fetch(
        `/api/cajero/renovacion/${tramite.id}/documentos`,
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

  const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const hayArchivo = Boolean(plano || fichaRuc);
  const sinTramite = consultado && !tramite;

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
          La renovación se hace acá, después de que la licencia venció. Si el
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
              limpiar();
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

        {sinTramite && (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
            El RUC {consultado} no tiene ningún trámite registrado. Si es un
            negocio nuevo, usa <strong>Registro presencial</strong>.
          </div>
        )}

        {/* Licencia todavía vigente: no hay nada que renovar */}
        {tramite && !renovable && (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm">
            <p className="font-bold text-white">{tramite.business.legalName}</p>

            <p className="mt-1 text-slate-300">
              Trámite {tramite.number} ·{" "}
              {ETIQUETAS[tramite.status] ?? tramite.status}
            </p>

            {tramite.license && (
              <p className="mt-2 text-slate-400">
                Licencia {tramite.license.licenseNumber}, vigente hasta el{" "}
                {fecha(tramite.license.expiresAt)}.
              </p>
            )}

            <p className="mt-2 text-amber-200">
              La renovación se habilita recién cuando la licencia vence.
            </p>
          </div>
        )}

        {/* Licencia vencida: documentos opcionales y cobro */}
        {tramite && renovable && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <p className="font-bold text-white">
                {tramite.business.legalName}
              </p>

              <p className="mt-1 text-amber-200">
                Trámite {tramite.number} · Licencia vencida
              </p>

              {tramite.license && (
                <p className="mt-2 text-slate-300">
                  Licencia {tramite.license.licenseNumber}, venció el{" "}
                  {fecha(tramite.license.expiresAt)}.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
              <div>
                <p className="text-sm font-bold text-white">
                  Paso 1 · Documentos actualizados{" "}
                  <span className="font-normal text-slate-500">(opcional)</span>
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Solo si cambió algo del local. Si no cambió nada, saltea este
                  paso: los documentos del trámite original siguen valiendo.
                </p>
              </div>

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
                      onChange={(e) => setPlano(e.target.files?.[0] ?? null)}
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
                      onChange={(e) => setFichaRuc(e.target.files?.[0] ?? null)}
                      className="mt-1.5 w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200"
                    />
                  </label>

                  {/* El "5MB" va a mano: si cambia el límite del servidor hay
                      que corregir este texto. */}
                  <p className="text-xs text-slate-500">
                    PDF, JPG o PNG. Máximo 5MB por archivo.
                  </p>

                  {errorSubida && (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorSubida}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={subirDocumentos}
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
                </>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
              <div>
                <p className="text-sm font-bold text-white">
                  Paso 2 · Cobrar la renovación
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Se cobra la misma tasa que un trámite nuevo, con factura y con
                  las mismas formas de pago. Al pagar, la licencia se extiende un
                  año y queda agendada una inspección inopinada en una fecha al
                  azar del período.
                </p>
              </div>

              <Link
                href="/cajero/pago"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition"
              >
                Ir al cobro
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
