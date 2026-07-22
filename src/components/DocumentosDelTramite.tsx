"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Paperclip,
  Upload,
} from "lucide-react";

type Documento = {
  id: string;
  type: string;
  name: string;
};

const ETIQUETAS: Record<string, string> = {
  FLOOR_PLAN: "Plano del local",
  RUC_RECORD: "Ficha RUC",
  ADDITIONAL: "Documento adicional",
};

/**
 * Documentos del trámite, con vista y reemplazo, para la pantalla de cobro.
 *
 * Sirve para lo que antes no se podía hacer en el mostrador: abrir el archivo
 * y mostrárselo al contribuyente antes de cobrarle. Si está equivocado, se
 * sube otro ahí mismo.
 *
 * El enlace apunta a `/api/public/documentos/{id}`, que es el que ya usan el
 * inspector y la consulta pública. No hace falta uno propio del cajero.
 */
export default function DocumentosDelTramite({
  applicationId,
  documentos,
  onReemplazado,
}: {
  applicationId: string;
  documentos: Documento[];
  onReemplazado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [plano, setPlano] = useState<File | null>(null);
  const [fichaRuc, setFichaRuc] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // El más reciente de cada tipo es el que vale: los reemplazos se agregan, no
  // pisan al anterior.
  const vigentes = ["FLOOR_PLAN", "RUC_RECORD"]
    .map((tipo) => {
      const delTipo = documentos.filter((documento) => documento.type === tipo);
      return delTipo[delTipo.length - 1];
    })
    .filter(Boolean) as Documento[];

  const reemplazar = async () => {
    setEnviando(true);
    setError(null);
    setExito(null);

    try {
      const formData = new FormData();
      if (plano) formData.append("plano", plano);
      if (fichaRuc) formData.append("fichaRuc", fichaRuc);

      const response = await fetch(`/api/cajero/reemplazar/${applicationId}`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setExito(data.message);
      setPlano(null);
      setFichaRuc(null);
      onReemplazado();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {vigentes.map((documento) => (
          <a
            key={documento.id}
            href={`/api/public/documentos/${documento.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-amber-500/50 hover:text-amber-200"
          >
            <FileText className="h-3.5 w-3.5" />
            {ETIQUETAS[documento.type] ?? documento.type}
            {/subsanad|reemplazad/i.test(documento.name) && (
              <span className="text-amber-400">· nuevo</span>
            )}
          </a>
        ))}

        <button
          type="button"
          onClick={() => setAbierto((previo) => !previo)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
        >
          <Paperclip className="h-3.5 w-3.5" />
          {abierto ? "Cancelar" : "Reemplazar"}
        </button>
      </div>

      {abierto && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <p className="text-xs text-slate-500">
            Sube solo el que esté mal. El anterior queda archivado para que el
            inspector vea con qué se lo reemplazó.
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-400">
              Plano del local
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setPlano(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-200"
              />
            </label>

            <label className="text-xs text-slate-400">
              Ficha RUC
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setFichaRuc(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-200"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={reemplazar}
            disabled={enviando || (!plano && !fichaRuc)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enviando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Subir reemplazo
          </button>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-rose-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {exito && (
        <p className="flex items-start gap-1.5 text-xs text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {exito}
        </p>
      )}
    </div>
  );
}
