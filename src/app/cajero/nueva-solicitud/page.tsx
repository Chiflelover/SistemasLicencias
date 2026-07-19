"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  Search,
} from "lucide-react";

type RucData = {
  ruc: string;
  legalName: string;
  fiscalAddress: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  estado?: string;
  condicion?: string;
};

export default function CajeroNuevaSolicitudPage() {
  const router = useRouter();

  const [ruc, setRuc] = useState("");
  const [rucData, setRucData] = useState<RucData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const buscarRuc = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setRucData(null);

    const cleanRuc = ruc.replace(/\D/g, "");

    if (cleanRuc.length !== 11) {
      setErrorMessage("El RUC debe tener 11 dígitos.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/ruc/${cleanRuc}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo consultar el RUC.");
      }

      setRucData(data);
    } catch (error: any) {
      setErrorMessage(error.message || "Error al consultar el RUC.");
    } finally {
      setLoading(false);
    }
  };

  const registrarSolicitud = async () => {
    if (!rucData) return;

    setSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/cajero/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruc: rucData.ruc }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo registrar la solicitud.");
      }

      setSuccessMessage(
        `Solicitud ${data.application.number} registrada correctamente.`
      );
      setRucData(null);
      setRuc("");

      router.refresh();
    } catch (error: any) {
      setErrorMessage(error.message || "Error al registrar la solicitud.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-3xl">
      <div>
        <Link
          href="/cajero"
          className="text-sm text-slate-400 hover:text-white inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al panel
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-white">
          Registrar solicitud presencial
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Ingresa el RUC del contribuyente que está siendo atendido en
          ventanilla. Los datos se traen de SUNAT.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-850 bg-slate-900/40 p-6 space-y-4">
        <label className="block text-xs uppercase tracking-wider font-bold text-slate-500">
          RUC del contribuyente
        </label>

        <div className="flex gap-3">
          <input
            value={ruc}
            onChange={(event) => setRuc(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") buscarRuc();
            }}
            placeholder="20172557628"
            maxLength={11}
            inputMode="numeric"
            className="flex-grow bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-amber-500"
          />

          <button
            onClick={buscarRuc}
            disabled={loading}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-5 py-3 rounded-lg text-sm font-bold flex items-center gap-2 transition"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Buscar
          </button>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200 text-sm flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200 text-sm flex gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {rucData && (
        <div className="rounded-2xl border border-slate-850 bg-slate-900/40 p-6 space-y-5">
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-slate-500">
                Razón social
              </p>
              <p className="text-white font-semibold">{rucData.legalName}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-slate-500">
                Domicilio fiscal
              </p>
              <p className="text-slate-300 text-sm">{rucData.fiscalAddress}</p>
              <p className="text-slate-500 text-xs mt-1">
                {rucData.distrito} · {rucData.provincia} · {rucData.departamento}
              </p>
            </div>
          </div>

          <div className="flex gap-4 text-xs">
            <span className="text-slate-400">
              Estado: <strong className="text-slate-200">{rucData.estado}</strong>
            </span>
            <span className="text-slate-400">
              Condición:{" "}
              <strong className="text-slate-200">{rucData.condicion}</strong>
            </span>
          </div>

          <button
            onClick={registrarSolicitud}
            disabled={saving}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 px-5 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Registrar solicitud
          </button>
        </div>
      )}
    </div>
  );
}
