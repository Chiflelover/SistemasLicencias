"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DocumentUploadSchema, type DocumentUploadValues } from "@/lib/validation/document";
import { UploadCloud, FileText, AlertTriangle, CheckCircle2, Shield, Info } from "lucide-react";

type UploadFormValues = DocumentUploadValues & {
  file?: FileList;
};

const ACCEPTED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function UploadDocumentForm({ applicationId }: { applicationId: string | null }) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UploadFormValues>({
    resolver: zodResolver(DocumentUploadSchema),
    defaultValues: {
      applicationId: applicationId ?? "",
      documentName: "",
      documentType: "RUC_RECORD",
      file: undefined as unknown as FileList,
    },
  });

  const validateFile = (files: FileList) => {
    if (!files || files.length === 0) {
      return "Selecciona un archivo para subir.";
    }

    const file = files[0];
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      return "Solo se permiten archivos PDF, JPG o PNG.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "El archivo no puede ser mayor a 5MB.";
    }

    return true;
  };

  const onSubmit = async (values: UploadFormValues) => {
    if (!applicationId) {
      setErrorMessage("No se encontró el trámite asociado. Inicia primero un trámite para subir documentos.");
      return;
    }

    const fileList = values.file;
    if (!fileList || fileList.length === 0) {
      setError("file", { type: "manual", message: "Selecciona un archivo válido." });
      return;
    }

    const file = fileList[0];

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setError("file", { type: "manual", message: "Solo se permiten archivos PDF, JPG o PNG." });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("file", { type: "manual", message: "El archivo no puede ser mayor a 5MB." });
      return;
    }

    setSuccessMessage(null);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("applicationId", applicationId);
    formData.append("documentName", values.documentName);
    formData.append("documentType", values.documentType);
    formData.append("file", file);

    try {
      const response = await fetch("/api/solicitante/subir-documentos", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error || "No se pudo subir el documento.");
        return;
      }

      setSuccessMessage("Documento subido correctamente.");
      reset({
        applicationId,
        documentName: "",
        documentType: "RUC_RECORD",
        file: undefined as unknown as FileList,
      });
    } catch (error) {
      setErrorMessage("Error de conexión. Intenta nuevamente.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-850 bg-slate-900/40 p-6 lg:p-8">
        <div className="flex items-center gap-3 text-amber-300 mb-4">
          <UploadCloud className="w-5 h-5" />
          <div>
            <h2 className="text-xl font-bold text-white">Subir documentos</h2>
            <p className="text-slate-400 text-sm">
              Adjunta tus archivos PDF, JPG o PNG. El contenido se guarda en la base de datos.
            </p>
          </div>
        </div>

        {!applicationId ? (
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="w-4 h-4" />
              No hay trámite activo
            </div>
            <p className="mt-2 text-slate-300 text-sm">
              Debes iniciar previamente un trámite para poder asociar documentos a una solicitud.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6">
            <input type="hidden" value={applicationId} {...register("applicationId") as any} />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-semibold">Nombre del documento</span>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <input
                    type="text"
                    {...register("documentName")}
                    placeholder="Ej. Plano de local"
                    className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </div>
                {errors.documentName && <p className="text-xs text-rose-400">{errors.documentName.message}</p>}
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-semibold">Tipo de documento</span>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <select
                    {...register("documentType")}
                    className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-500"
                  >
                    <option value="FLOOR_PLAN">Plano del local</option>
                    <option value="RUC_RECORD">Registro RUC</option>
                    <option value="ADDITIONAL">Documento adicional</option>
                  </select>
                </div>
              </label>
            </div>

            <label className="space-y-2 text-sm text-slate-300">
              <span className="font-semibold">Archivo</span>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png"
                  {...register("file", { validate: validateFile })}
                  className="w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:text-slate-950 file:font-semibold file:transition file:hover:bg-amber-400"
                />
              </div>
              {errors.file && <p className="text-xs text-rose-400">{errors.file.message as string}</p>}
            </label>

            <div className="rounded-3xl border border-slate-850 bg-slate-950/40 p-4 text-slate-400">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-2">
                <Info className="w-4 h-4 text-amber-400" />
                Requisitos del archivo
              </div>
              <ul className="space-y-1 text-xs text-slate-500">
                <li>PDF, JPG o PNG.</li>
                <li>Máximo 5MB.</li>
                <li>El archivo se almacena en PostgreSQL como binario.</li>
              </ul>
            </div>

            {successMessage && (
              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {successMessage}
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {errorMessage}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500">Selecciona el documento y presiona guardar.</div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Subiendo..." : "Subir documento"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
