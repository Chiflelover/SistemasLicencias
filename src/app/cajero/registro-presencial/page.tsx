"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { checkRucEligibility } from "@/lib/ruc-eligibility";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileUp,
  Loader2,
  Search,
} from "lucide-react";

type TramiteExistente = {
  id: string;
  number: string;
  status: string;
  motivo: "EN_PROCESO" | "YA_TIENE_LICENCIA" | "LICENCIA_VENCIDA";
};

type SunatData = {
  ruc: string;
  legalName: string;
  fiscalAddress: string;
  estado?: string;
  condicion?: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  tramiteExistente?: TramiteExistente | null;
};

const ETIQUETAS_ESTADO: Record<string, string> = {
  DRAFT: "BORRADOR",
  DOCUMENTS_COMPLETE: "DOCUMENTOS COMPLETOS",
  PENDING_PAYMENT: "PAGO PENDIENTE",
  PAYMENT_COMPLETED: "PAGO COMPLETADO",
  INSPECTION_SCHEDULED: "INSPECCIÓN PROGRAMADA",
  FIRST_INSPECTION_REJECTED: "OBSERVADO",
  SECOND_INSPECTION_SCHEDULED: "OBSERVADO · 2DA INSPECCIÓN PROGRAMADA",
  LICENSE_ISSUED: "LICENCIA EMITIDA",
  RENEWAL_AVAILABLE: "LICENCIA POR VENCER",
};

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase();
}

function esDeTrujillo(data: SunatData) {
  return (
    normalizar(data.distrito || "") === "TRUJILLO" &&
    normalizar(data.provincia || "") === "TRUJILLO" &&
    normalizar(data.departamento || "") === "LA LIBERTAD"
  );
}

const CAMPOS_INICIALES = {
  ruc: "",
  legalName: "",
  fiscalAddress: "",
  representativeName: "",
  representativeDni: "",
  representativeRole: "Representante Legal",
  activityType: "",
  email: "",
  phone: "",
};

export default function RegistroPresencialPage() {
  const router = useRouter();

  const [campos, setCampos] = useState(CAMPOS_INICIALES);
  const [plano, setPlano] = useState<File | null>(null);
  const [certificados, setCertificados] = useState<File | null>(null);

  const [buscandoRuc, setBuscandoRuc] = useState(false);
  const [buscandoDni, setBuscandoDni] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Datos de SUNAT: los mismos que ve el ciudadano en el trámite público.
  const [sunat, setSunat] = useState<SunatData | null>(null);

  const elegibilidad = sunat
    ? checkRucEligibility(sunat)
    : { elegible: true as boolean, motivo: undefined };

  const enJurisdiccion = sunat ? esDeTrujillo(sunat) : false;
  const tramiteExistente = sunat?.tramiteExistente ?? null;

  // El cajero no puede registrar lo que el sistema rechazaría igual, ni abrir
  // un segundo trámite para un RUC que ya tiene uno en curso.
  const puedeRegistrar =
    Boolean(sunat) &&
    elegibilidad.elegible &&
    enJurisdiccion &&
    !tramiteExistente &&
    campos.activityType.trim().length >= 3;

  const actualizar = (campo: keyof typeof CAMPOS_INICIALES, valor: string) => {
    setCampos((previo) => ({ ...previo, [campo]: valor }));
  };

  // Llegada desde "Renovación de licencia": el RUC viene en la URL y se
  // consulta solo, para que el cajero no lo tenga que tipear de nuevo.
  // Se lee de window y no con useSearchParams para no obligar a envolver la
  // página en un Suspense.
  useEffect(() => {
    const rucDeLaUrl = new URLSearchParams(window.location.search).get("ruc");

    if (rucDeLaUrl && /^\d{11}$/.test(rucDeLaUrl)) {
      setCampos((previo) => ({ ...previo, ruc: rucDeLaUrl }));
      buscarRuc(rucDeLaUrl);
    }
    // Solo al montar: es la carga inicial desde el enlace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Autocompleta el nombre del representante al completar los 8 dígitos.
   *
   * El correo y el teléfono no vienen de RENIEC: los releva el cajero, pero
   * siguen siendo obligatorios.
   */
  const buscarDni = async (dni: string) => {
    const limpio = dni.replace(/\D/g, "");

    if (limpio.length !== 8) {
      return;
    }

    setBuscandoDni(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/dni/${limpio}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo consultar el DNI.");
      }

      if (data.fullName) {
        setCampos((previo) => ({ ...previo, representativeName: data.fullName }));
      }
    } catch (error: any) {
      // No bloquea el registro: el cajero puede escribir el nombre a mano.
      setErrorMessage(`${error.message} Puedes escribir el nombre manualmente.`);
    } finally {
      setBuscandoDni(false);
    }
  };

  const buscarRuc = async (rucInicial?: string) => {
    // Acepta el RUC por parámetro porque al llegar desde "Renovación de
    // licencia" se consulta en el mismo tick en que se llena el campo, y el
    // estado todavía no se actualizó.
    const cleanRuc = (rucInicial ?? campos.ruc).replace(/\D/g, "");

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

      setSunat(data);

      setCampos((previo) => ({
        ...previo,
        ruc: data.ruc,
        legalName: data.legalName,
        fiscalAddress: data.fiscalAddress,
      }));
    } catch (error: any) {
      setSunat(null);
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
        `Solicitud ${data.application.number} registrada. Te llevamos al cobro...`
      );

      setCampos(CAMPOS_INICIALES);
      setPlano(null);
      setCertificados(null);
      (event.target as HTMLFormElement).reset();

      // Al cobro automáticamente. Un instante para que el cajero vea la
      // confirmación antes de cambiar de pantalla.
      setTimeout(() => router.push("/cajero/pago"), 1200);
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
                onChange={(e) =>
                  actualizar("ruc", e.target.value.replace(/\D/g, "").slice(0, 11))
                }
                placeholder="20172557628"
                maxLength={11}
                inputMode="numeric"
                required
                className={`${inputClass} font-mono`}
              />
              <button
                type="button"
                onClick={() => buscarRuc()}
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
              Trae razón social y domicilio desde SUNAT. Puedes editarlos después.
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

          {/* SUNAT no informa el giro: lo declara el contribuyente y el
              cajero lo transcribe. Va impreso en la licencia. */}
          <div>
            <label className={labelClass}>Rubro o giro del negocio</label>
            <input
              value={campos.activityType}
              onChange={(e) => actualizar("activityType", e.target.value)}
              required
              minLength={3}
              maxLength={80}
              placeholder="Ej. Bodega, restaurante, ferretería"
              className={inputClass}
            />
          </div>

          {/* Datos de SUNAT, los mismos que ve el ciudadano en el flujo
              público. Se muestran solo lectura: son la fuente de verdad. */}
          {sunat && (
            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className={labelClass}>Estado tributario</p>
                  <p
                    className={`text-sm font-bold ${
                      normalizar(sunat.estado || "") === "ACTIVO"
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}
                  >
                    {sunat.estado || "No registrado"}
                  </p>
                </div>

                <div>
                  <p className={labelClass}>Condición de domicilio</p>
                  <p
                    className={`text-sm font-bold ${
                      normalizar(sunat.condicion || "") === "HABIDO"
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}
                  >
                    {sunat.condicion || "No registrada"}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className={labelClass}>Distrito</p>
                  <p className="text-sm text-slate-200">
                    {sunat.distrito || "—"}
                  </p>
                </div>
                <div>
                  <p className={labelClass}>Provincia</p>
                  <p className="text-sm text-slate-200">
                    {sunat.provincia || "—"}
                  </p>
                </div>
                <div>
                  <p className={labelClass}>Departamento</p>
                  <p className="text-sm text-slate-200">
                    {sunat.departamento || "—"}
                  </p>
                </div>
              </div>

              {tramiteExistente ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>
                    {tramiteExistente.motivo === "EN_PROCESO"
                      ? "Este RUC ya tiene un trámite en proceso"
                      : "Este RUC ya cuenta con una licencia vigente"}
                    :{" "}
                    <strong className="font-mono">
                      {tramiteExistente.number}
                    </strong>{" "}
                    ·{" "}
                    {ETIQUETAS_ESTADO[tramiteExistente.status] ??
                      tramiteExistente.status.replaceAll("_", " ")}
                    . No corresponde registrar otro.
                  </span>
                </div>
              ) : !elegibilidad.elegible ? (
                <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{elegibilidad.motivo}</span>
                </div>
              ) : !enJurisdiccion ? (
                <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>
                    Fuera de jurisdicción: solo se atienden establecimientos del
                    distrito de Trujillo, provincia de Trujillo, La Libertad.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>RUC habilitado para registrar el trámite.</span>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-850 bg-slate-900/40 p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Representante legal y contacto
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* El DNI va primero: al completarlo se autocompleta el nombre. */}
            <div>
              <label className={labelClass}>DNI</label>
              <div className="relative">
                <input
                  value={campos.representativeDni}
                  onChange={(e) => {
                    const limpio = e.target.value.replace(/\D/g, "").slice(0, 8);
                    actualizar("representativeDni", limpio);

                    if (limpio.length === 8) {
                      buscarDni(limpio);
                    }
                  }}
                  required
                  maxLength={8}
                  inputMode="numeric"
                  placeholder="8 dígitos"
                  className={`${inputClass} font-mono`}
                />

                {buscandoDni && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-amber-400" />
                )}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Al completarlo se trae el nombre desde RENIEC.
              </p>
            </div>

            <div>
              <label className={labelClass}>Nombre completo</label>
              <input
                value={campos.representativeName}
                onChange={(e) => actualizar("representativeName", e.target.value)}
                required
                minLength={3}
                placeholder="Se completa con el DNI"
                className={inputClass}
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
                onChange={(e) =>
                  actualizar("phone", e.target.value.replace(/\D/g, "").slice(0, 9))
                }
                required
                maxLength={9}
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

          {/* El "5MB" va a mano. Si cambia el límite del servidor
              (src/app/api/cajero/registro-presencial/route.ts, que lista todos
              los archivos a tocar), hay que corregir este texto o la pantalla
              promete algo que el servidor no acepta. */}
          <p className="text-xs text-slate-500">
            PDF, JPG o PNG. Máximo 5MB por archivo.
          </p>
        </section>

        <button
          type="submit"
          disabled={guardando || !puedeRegistrar}
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
