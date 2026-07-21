"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";

type Props = {
  applicationId: string;
  hasFloorPlan?: boolean;
  hasRucRecord?: boolean;
};

/** Los dos documentos que el trámite exige, con su nombre ya definido. */
const REQUERIDOS = [
  {
    type: "FLOOR_PLAN",
    label: "Plano del local",
    descripcion: "Plano del establecimiento en PDF, JPG o PNG.",
  },
  {
    type: "RUC_RECORD",
    label: "Ficha RUC",
    descripcion: "Constancia o ficha RUC del negocio.",
  },
] as const;

export default function PublicDocumentUploadForm({
  applicationId,
  hasFloorPlan = false,
  hasRucRecord = false,
}: Props) {
  const router = useRouter();

  // Qué documento se está subiendo en este momento, para el indicador.
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const yaSubido: Record<string, boolean> = {
    FLOOR_PLAN: hasFloorPlan,
    RUC_RECORD: hasRucRecord,
  };

  /**
   * Sube el archivo apenas se elige, sin paso intermedio.
   *
   * El nombre y el tipo salen del propio recuadro, así que el administrado
   * solo tiene que elegir el archivo correcto.
   */
  const subir = async (tipo: string, etiqueta: string, archivo: File) => {
    setSubiendo(tipo);
    setError(null);
    setMensaje(null);

    try {
      const formData = new FormData();
      formData.append("name", etiqueta);
      formData.append("type", tipo);
      formData.append("file", archivo);

      const response = await fetch(
        `/api/public/tramite/${applicationId}/documentos`,
        { method: "POST", body: formData }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo subir el documento.");
      }

      setMensaje(data.message || `${etiqueta} subido correctamente.`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendo(null);

      // Permite volver a elegir el mismo archivo si hubo que corregir algo.
      const input = inputs.current[tipo];
      if (input) input.value = "";
    }
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex items-center gap-3 text-amber-300">
        <FileUp className="h-6 w-6" />
        <h2 className="text-xl font-bold text-white">Subir documentos</h2>
      </div>

      <p className="mt-3 text-sm text-slate-400">
        Elige el archivo de cada requisito. Se sube automáticamente y, cuando
        ambos estén listos, se habilita el pago.
      </p>

      {error && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {mensaje && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p>{mensaje}</p>
        </div>
      )}

      <div className="mt-6 grid gap-4">
        {REQUERIDOS.map(({ type, label, descripcion }) => {
          const listo = yaSubido[type];
          const cargando = subiendo === type;

          return (
            <div
              key={type}
              className={`flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${
                listo
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-slate-800 bg-slate-950/70"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  {listo && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  )}
                  <p
                    className={`font-bold ${
                      listo ? "text-emerald-200" : "text-white"
                    }`}
                  >
                    {label}
                  </p>
                </div>

                <p className="mt-1 text-sm text-slate-400">
                  {listo ? "Ya está subido. Puedes reemplazarlo." : descripcion}
                </p>
              </div>

              <label
                className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition sm:whitespace-nowrap ${
                  cargando
                    ? "cursor-wait bg-slate-800 text-slate-400"
                    : listo
                    ? "border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                    : "bg-amber-500 text-slate-950 hover:bg-amber-400"
                }`}
              >
                {cargando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {listo ? "Reemplazar" : "Seleccionar archivo"}
                  </>
                )}

                <input
                  ref={(el) => {
                    inputs.current[type] = el;
                  }}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  disabled={cargando}
                  onChange={(event) => {
                    const archivo = event.target.files?.[0];
                    if (archivo) subir(type, label, archivo);
                  }}
                  className="hidden"
                />
              </label>
            </div>
          );
        })}
      </div>

      {/* El "5MB" va a mano. Si cambia el límite del servidor
          (src/app/api/public/tramite/[applicationId]/documentos/route.ts, que
          lista todos los archivos a tocar), hay que corregir este texto o la
          pantalla promete algo que el servidor no acepta. */}
      <p className="mt-4 text-xs text-slate-500">
        PDF, JPG o PNG. Máximo 5MB por archivo.
      </p>
    </div>
  );
}
