"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileUp,
  Loader2,
  Search,
} from "lucide-react";

const CAMPOS_INICIALES = {
  ruc: "",
  legalName: "",
  fiscalAddress: "",
  representativeName: "",
  representativeDni: "",
  representativeRole: "Representante Legal",
  email: "",
  phone: "",
};

export default function RegistroPresencialPage() {
  const router = useRouter();

  const [campos, setCampos] = useState(CAMPOS_INICIALES);
  const [plano, setPlano] = useState<File | null>(null);
  const [certificados, setCertificados] = useState<File | null>(null);

  const [buscandoRuc, setBuscandoRuc] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const actualizar = (campo: keyof typeof CAMPOS_INICIALES, valor: string) => {
    setCampos((previo) => ({ ...previo, [campo]: valor }));
  };

  const buscarRuc = async () => {
    const cleanRuc = campos.ruc.replace(/\D/g, "");

    if (cleanRuc.length !== 11) {
      setErrorMessage("El RUC debe tener 11 dígitos.");
      return;
    }

    setBuscandoRuc(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/ruc/${cleanRuc}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo consultar el RUC.");
      }

      setCampos((previo) => ({
        ...previo,
        ruc: data.ruc,
        legalName: data.legalName,
        fiscalAddress: data.fiscalAddress,
      }));
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setBuscandoRuc(false);
    }
  };

  const registrar = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!plano || !certificados) {
      setErrorMessage("Adjunta el plano del local y los certificados.");
      return;
    }

    setGuardando(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();

      Object.entries(campos).forEach(([clave, valor]) => {
        formData.append(clave, valor);
      });

      formData.append("plano", plano);
      formData.append("certificados", certificados);

      const response = await fetch("/api/cajero/registro-presencial", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo registrar la solicitud.");
      }

      setSuccessMessage(
        `Solicitud ${data.application.number} registrada (estado: ${data.application.status}). Ya podés cobrarla desde Registrar Pago.`
      );

      setCampos(CAMPOS_INICIALES);
      setPlano(null);
      setCertificados(null);
      (event.target as HTMLFormElement).reset();

      router.refresh();
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setGuardando(false);
    }
  };

  const inputClass =
    "w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500";
  const labelClass =
    "block text-xs uppercase tracking-wider font-bold text-slate-500 mb-1.5";

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
          Releva los datos del contribuyente atendido en ventanilla y adjunta la
          documentación. La solicitud queda lista para el cobro.
        </p>
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

      <form onSubmit={registrar} className="space-y-6">
        <section className="rounded-2xl border border-slate-850 bg-slate-900/40 p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Datos del negocio
          </h2>

          <div>
            <label className={labelClass}>RUC</label>
            <div className="flex gap-3">
              <input
                value={campos.ruc}
                onChange={(e) => actualizar("ruc", e.target.value)}
                placeholder="20172557628"
                maxLength={11}
                inputMode="numeric"
                required
                className={`${inputClass} font-mono`}
              />
              <button
                type="button"
                onClick={buscarRuc}
                disabled={buscandoRuc}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-5 rounded-lg text-sm font-bold flex items-center gap-2 transition whitespace-nowrap"
              >
                {buscandoRuc ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Autocompletar
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Trae razón social y domicilio desde SUNAT. Podés editarlos después.
            </p>
          </div>

          <div>
            <label className={labelClass}>Razón social</label>
            <input
              value={campos.legalName}
              onChange={(e) => actualizar("legalName", e.target.value)}
              required
              minLength={3}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Domicilio fiscal</label>
            <input
              value={campos.fiscalAddress}
              onChange={(e) => actualizar("fiscalAddress", e.target.value)}
              required
              minLength={5}
              className={inputClass}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-850 bg-slate-900/40 p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Representante legal y contacto
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Nombre completo</label>
              <input
                value={campos.representativeName}
                onChange={(e) => actualizar("representativeName", e.target.value)}
                required
                minLength={3}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>DNI</label>
              <input
                value={campos.representativeDni}
                onChange={(e) => actualizar("representativeDni", e.target.value)}
                maxLength={8}
                inputMode="numeric"
                className={`${inputClass} font-mono`}
              />
            </div>

            <div>
              <label className={labelClass}>Correo electrónico</label>
              <input
                type="email"
                value={campos.email}
                onChange={(e) => actualizar("email", e.target.value)}
                required
                placeholder="contribuyente@gmail.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Teléfono</label>
              <input
                value={campos.phone}
                onChange={(e) => actualizar("phone", e.target.value)}
                required
                placeholder="987654321"
                inputMode="tel"
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-850 bg-slate-900/40 p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Documentos requeridos
          </h2>

          <div>
            <label className={labelClass}>Plano del local</label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setPlano(e.target.files?.[0] || null)}
              required
              className="w-full text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200 file:text-xs file:font-bold hover:file:bg-slate-700 cursor-pointer"
            />
          </div>

          <div>
            <label className={labelClass}>Certificados</label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setCertificados(e.target.files?.[0] || null)}
              required
              className="w-full text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200 file:text-xs file:font-bold hover:file:bg-slate-700 cursor-pointer"
            />
          </div>

          <p className="text-xs text-slate-500">
            PDF, JPG o PNG. Máximo 5MB por archivo.
          </p>
        </section>

        <button
          type="submit"
          disabled={guardando}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 px-5 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
        >
          {guardando ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileUp className="w-4 h-4" />
          )}
          Registrar solicitud presencial
        </button>
      </form>
    </div>
  );
}
