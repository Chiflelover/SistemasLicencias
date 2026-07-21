"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, FileUp, Loader2 } from "lucide-react";

interface SubsanarPublicoProps {
  applicationId: string;
  applicationNumber: string;
  legalName: string;
}

export default function SubsanarPublico({
  applicationId,
  applicationNumber,
  legalName,
}: SubsanarPublicoProps) {
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState("");
  const [plano, setPlano] = useState<File | null>(null);
  const [fichaRuc, setFichaRuc] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const hayArchivo = Boolean(plano || fichaRuc);

  const enviar = async () => {
    setError(null);
    setExito(null);

    if (!emailValido) {
      setError("Ingresá el correo con el que se registró el trámite.");
      return;
    }
    if (!hayArchivo) {
      setError("Adjuntá al menos un documento corregido.");
      return;
    }

    setEnviando(true);

    try {
      const formData = new FormData();
      formData.append("email", email.trim());
      if (plano) formData.append("plano", plano);
      if (fichaRuc) formData.append("fichaRuc", fichaRuc);

      const response = await fetch(
        `/api/public/tramite/${applicationId}/subsanar`,
        { method: "POST", body: formData }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo subsanar.");

      setExito(data.message);
      setPlano(null);
      setFichaRuc(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
      >
        <FileUp className="h-4 w-4" />
        Subsanar documentos
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
      <p className="text-sm font-bold text-white">
        Subsanar el trámite {applicationNumber}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        {legalName}. Por seguridad, ingresá el correo con el que se registró el
        trámite. Solo así se aceptan los documentos corregidos.
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
              Correo registrado
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-slate-100 outline-none focus:border-amber-400"
            />
          </label>

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
            Adjuntá el documento que el inspector observó. Podés subir uno o los
            dos.
          </p>

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={enviar}
            disabled={enviando || !emailValido || !hayArchivo}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enviando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileUp className="w-4 h-4" />
            )}
            Enviar documentos corregidos
          </button>
        </div>
      )}
    </div>
  );
}
