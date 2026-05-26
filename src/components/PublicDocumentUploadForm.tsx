"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, FileUp, Loader2 } from "lucide-react";

type Props = {
  applicationId: string;
};

export default function PublicDocumentUploadForm({ applicationId }: Props) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [type, setType] = useState("FLOOR_PLAN");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setMessage(null);
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Ingresa el nombre del documento.");
      return;
    }

    if (!file) {
      setErrorMessage("Selecciona un archivo.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("type", type);
      formData.append("file", file);

      const response = await fetch(
        `/api/public/tramite/${applicationId}/documentos`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo subir el documento.");
      }

      setMessage(data.message || "Documento subido correctamente.");
      setName("");
      setType("FLOOR_PLAN");
      setFile(null);

      const fileInput = document.getElementById(
        "public-file-input"
      ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }

      router.refresh();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleUpload}
      className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6"
    >
      <div className="flex items-center gap-3 text-amber-300">
        <FileUp className="h-6 w-6" />
        <h2 className="text-xl font-bold text-white">Subir documentos</h2>
      </div>

      <p className="mt-3 text-sm text-slate-400">
        Adjunta el plano del local y la ficha RUC. Cuando ambos estén subidos,
        el pago quedará habilitado.
      </p>

      {errorMessage && (
        <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {message && (
        <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {message}
        </div>
      )}

      <div className="mt-6 grid gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">
            <span className="font-semibold">Nombre del documento</span>

            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Plano del local"
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-500/50"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-300">
            <span className="font-semibold">Tipo de documento</span>

            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-amber-500/50"
            >
              <option value="FLOOR_PLAN">Plano del local</option>
              <option value="RUC_RECORD">Ficha RUC</option>
              <option value="ADDITIONAL">Documento adicional</option>
            </select>
          </label>
        </div>

        <label className="space-y-2 text-sm text-slate-300">
          <span className="font-semibold">Archivo</span>

          <input
            id="public-file-input"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-white file:mr-4 file:rounded-xl file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:font-bold file:text-slate-950 hover:file:bg-amber-400"
          />
        </label>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
          PDF, JPG o PNG. Máximo 5MB.
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 font-bold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
          {isSubmitting ? "Subiendo..." : "Subir documento"}
        </button>
      </div>
    </form>
  );
}