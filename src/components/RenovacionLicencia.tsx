"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, Plus, RefreshCw, Search } from "lucide-react";

type Resultado = {
  id: string;
  number: string;
  status: string;
  business: { ruc: string; legalName: string };
  license: { licenseNumber: string; status: string; expiresAt: string } | null;
};

/** Estados en los que el negocio todavía tiene un trámite abierto. */
const EN_CURSO = [
  "DRAFT",
  "DOCUMENTS_COMPLETE",
  "PENDING_PAYMENT",
  "PAYMENT_COMPLETED",
  "INSPECTION_SCHEDULED",
  "FIRST_INSPECTION_REJECTED",
  "SECOND_INSPECTION_SCHEDULED",
];

/** Estados con licencia vigente: no corresponde iniciar un trámite nuevo. */
const CON_LICENCIA = ["LICENSE_ISSUED", "RENEWAL_AVAILABLE"];

export default function RenovacionLicencia() {
  const [ruc, setRuc] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consultado, setConsultado] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const consultar = async () => {
    if (ruc.length !== 11) {
      setError("El RUC debe tener 11 dígitos.");
      return;
    }

    setConsultando(true);
    setError(null);
    setResultado(null);
    setConsultado(null);

    try {
      // La consulta pública sincroniza los vencimientos antes de responder,
      // así que el estado que devuelve ya está al día.
      const response = await fetch(
        `/api/public/consulta?q=${encodeURIComponent(ruc)}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo consultar el RUC.");
      }

      // La búsqueda es por coincidencia parcial: hay que quedarse con el RUC
      // exacto, y de ese negocio con el trámite más reciente.
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

  const vencida = resultado?.status === "EXPIRED";
  const conLicencia = resultado && CON_LICENCIA.includes(resultado.status);
  const enCurso = resultado && EN_CURSO.includes(resultado.status);
  const sinTramites = consultado && !resultado;

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
          Consulta el RUC para verificar si la licencia venció. Una licencia
          vencida no se renueva: corresponde iniciar un trámite nuevo desde
          cero, con documentos, pago e inspección.
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

        {vencida && resultado && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm font-bold text-white">
              {resultado.business.legalName}
            </p>

            <p className="mt-1 text-sm text-amber-200">
              Licencia {resultado.license?.licenseNumber} vencida
              {resultado.license
                ? ` el ${new Date(
                    resultado.license.expiresAt
                  ).toLocaleDateString("es-PE")}`
                : ""}
              . Corresponde iniciar un trámite nuevo.
            </p>

            <Link
              href={`/cajero/registro-presencial?ruc=${resultado.business.ruc}`}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2.5 text-sm font-bold transition"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Iniciar trámite nuevo
            </Link>
          </div>
        )}

        {conLicencia && resultado && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
            <p className="font-bold text-white">
              {resultado.business.legalName}
            </p>

            <p className="mt-1 text-emerald-200">
              Tiene licencia vigente
              {resultado.license
                ? ` hasta el ${new Date(
                    resultado.license.expiresAt
                  ).toLocaleDateString("es-PE")}`
                : ""}
              . No corresponde iniciar un trámite nuevo.
            </p>
          </div>
        )}

        {enCurso && resultado && (
          <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4 text-sm">
            <p className="font-bold text-white">
              {resultado.business.legalName}
            </p>

            <p className="mt-1 text-slate-400">
              Ya tiene el trámite {resultado.number} en curso. Hay que esperar a
              que termine.
            </p>
          </div>
        )}

        {sinTramites && (
          <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4 text-sm">
            <p className="text-slate-400">
              Ese RUC no tiene trámites registrados. Si el negocio quiere su
              primera licencia, se registra como trámite nuevo.
            </p>

            <Link
              href={`/cajero/registro-presencial?ruc=${consultado}`}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-200 px-5 py-2.5 text-sm font-bold transition"
            >
              <Plus className="w-4 h-4" />
              Registrar trámite
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
