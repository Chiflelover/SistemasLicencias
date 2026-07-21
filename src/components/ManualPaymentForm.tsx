"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, AlertCircle, CheckCircle2, Image as ImageIcon, Loader2 } from "lucide-react";

interface ManualPaymentFormProps {
  applicationId: string;
}

export default function ManualPaymentForm({ applicationId }: ManualPaymentFormProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (selectedFile: File) => {
    setError(null);
    if (!selectedFile.type.startsWith("image/") && selectedFile.type !== "application/pdf") {
      setError("Solo se permiten archivos de imagen (PNG, JPG, JPEG) o PDF.");
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("El archivo no debe superar los 5MB.");
      return;
    }

    setFile(selectedFile);
    if (selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreviewUrl(null); // No preview for PDF
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileChange(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Por favor, selecciona o arrastra una imagen de tu comprobante.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/public/tramite/${applicationId}/pago/manual`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo registrar el pago manual.");
      }

      setSuccess(
        `¡Pago registrado con éxito! Nº de operación: ${data.operationNumber}. Inspector asignado: ${data.inspector.fullName}. Desplázate hacia abajo para ver los datos de tu inspección.`
      );

      // Solo recargamos la página actual para que el bloque 4 muestre
      // el inspector y la hora asignados sin redirigir a ninguna otra ruta.
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Drag & Drop Area */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition ${
            dragActive
              ? "border-amber-400 bg-amber-500/10"
              : file
              ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
              : "border-slate-800 bg-slate-950/40 hover:bg-slate-900/60"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={onFileSelect}
            className="hidden"
          />

          {file ? (
            <div className="space-y-3 text-center">
              {previewUrl ? (
                <div className="relative w-32 h-32 mx-auto rounded-xl overflow-hidden border border-emerald-500/20 shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Vista previa del comprobante" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Upload className="w-6 h-6 animate-pulse" />
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-white max-w-xs truncate mx-auto">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <span className="inline-block text-xs font-semibold text-amber-400 hover:text-amber-300">
                Hacer clic para cambiar de archivo
              </span>
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-slate-900 border border-slate-850 flex items-center justify-center text-slate-400 group-hover:text-amber-400 transition-colors">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-300">Selecciona o arrastra el comprobante</p>
                <p className="text-xs text-slate-500 mt-1">Formatos permitidos: PNG, JPG, JPEG o PDF (Máx. 5MB)</p>
              </div>
            </div>
          )}
        </div>

        {/* El aviso de que no hay devoluciones se movió arriba, antes del
            botón de pago: advertirlo recién acá llegaba tarde, cuando el
            dinero ya estaba pagado. Sin él, el recuadro que lo acompañaba
            quedaba vacío, así que el botón va suelto. */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!file || loading || success !== null}
            className={`w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-3.5 text-sm font-extrabold uppercase tracking-wider transition disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando pago...
              </>
            ) : (
              "Enviar pago"
            )}
          </button>
        </div>
      </form>

      {/* Status Messages */}
      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200 flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-200 flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
          <div>
            <p className="font-bold">¡Comprobante enviado!</p>
            <p className="mt-1 text-slate-300 leading-normal">{success}</p>
            <p className="mt-3 text-xs text-amber-300 font-semibold">
              ↓ Revisa el panel derecho &mdash; el bloque <strong>4. Inspección</strong> ya muestra tu inspector y la fecha asignada.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
