"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, FileUp, Loader2, Search } from "lucide-react";

type Resultado = {
  id: string;
  number: string;
  status: string;
  business: { ruc: string; legalName: string };
};

/** Estados del ciclo de observación en los que se puede subsanar. */
const OBSERVADO = ["FIRST_INSPECTION_REJECTED", "SECOND_INSPECTION_SCHEDULED"];

const ETIQUETA_OBSERVADO: Record<string, string> = {
  FIRST_INSPECTION_REJECTED: "Observado",
  SECOND_INSPECTION_SCHEDULED: "Observado · 2da inspección programada",
};

export default function SubsanarTramite() {
  const [ruc, setRuc] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consultado, setConsultado] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  // Carga de los documentos corregidos, en esta misma pantalla: el cajero no
  // debe terminar en la página del ciudadano, que le habla de tú y le ofrece
  // continuar al pago.
  const [plano, setPlano] = useState<File | null>(null);
  const [fichaRuc, setFichaRuc] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const limpiarSubida = () => {
    setPlano(null);
    setFichaRuc(null);
    setErrorSubida(null);
    setExito(null);
  };

  const consultar = async () => {
    if (ruc.length !== 11) {
      setError("El RUC debe tener 11 dígitos.");
      return;
    }

    setConsultando(true);
    setError(null);
    setResultado(null);
    setConsultado(null);
    limpiarSubida();

    try {
      const response = await fetch(
        `/api/public/consulta?q=${encodeURIComponent(ruc)}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo consultar el RUC.");
      }

      // RUC exacto y su trámite más reciente.
      const exactos = (data.results as Resultado[]).filter(
        (item) => item.business.ruc === ruc
      );

      setResultado(exactos[0] ?? null);
      setConsultado(ruc);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConsultando(false);
    }
  };

  const subsanar = async () => {
    if (!resultado) return;

    setErrorSubida(null);
    setExito(null);

    if (!plano && !fichaRuc) {
      setErrorSubida("Adjuntá al menos un documento corregido.");
      return;
    }

    setSubiendo(true);

    try {
      const formData = new FormData();
      if (plano) formData.append("plano", plano);
      if (fichaRuc) formData.append("fichaRuc", fichaRuc);

      const response = await fetch(`/api/cajero/subsanar/${resultado.id}`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudieron subir los documentos.");
      }

      setExito(data.message);
      setPlano(null);
      setFichaRuc(null);
    } catch (err: any) {
      setErrorSubida(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  const observado = resultado && OBSERVADO.includes(resultado.status);
  const sinObservacion = consultado && (!resultado || !observado);
  const hayArchivo = Boolean(plano || fichaRuc);

  return (
    <div className="rounded-2xl border border-slate-850 bg-slate-900/40 overflow-hidden">
      <div className="p-5 border-b border-slate-850">
        <div className="flex items-center gap-2">
          <FileUp className="w-4 h-4 text-amber-400" />
          <h2 className="text-lg font-bold text-white">
            Subsanar documentos de trámite
          </h2>
        </div>

        <p className="mt-1 text-sm text-slate-400">
          Consulta el RUC de un trámite observado en la inspección para volver
          a subir los documentos corregidos.
        </p>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={ruc}
            onChange={(e) => {
              setRuc(e.target.value.replace(/\D/g, "").slice(0, 11));
              setResultado(null);
              setConsultado(null);
              setError(null);
              limpiarSubida();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") consultar();
            }}
            inputMode="numeric"
            placeholder="RUC del trámite observado (11 dígitos)"
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

        {observado && resultado && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm font-bold text-white">
              {resultado.business.legalName}
            </p>

            <p className="mt-1 text-sm text-amber-200">
              Trámite {resultado.number} ·{" "}
              {ETIQUETA_OBSERVADO[resultado.status] ?? "Observado"}. Podés
              subir los documentos corregidos.
            </p>

            {exito ? (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{exito}</span>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                    Plano del local (corregido)
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
                    Ficha RUC (corregida)
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setFichaRuc(e.target.files?.[0] ?? null)}
                    className="mt-1.5 w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200"
                  />
                </label>

                <p className="text-xs text-slate-500">
                  Adjuntá el documento que el inspector observó. Podés subir uno
                  o los dos. La subsanación no tiene costo: no corresponde
                  cobrar nada.
                </p>

                {errorSubida && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorSubida}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={subsanar}
                  disabled={subiendo || !hayArchivo}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 px-5 py-2.5 text-sm font-bold transition"
                >
                  {subiendo ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileUp className="w-4 h-4" />
                  )}
                  Subir documentos corregidos
                </button>
              </div>
            )}
          </div>
        )}

        {sinObservacion && (
          <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-400">
            Ese RUC no tiene ningún trámite observado. Solo se pueden subsanar
            trámites que fueron observados en la inspección.
          </div>
        )}
      </div>
    </div>
  );
}
