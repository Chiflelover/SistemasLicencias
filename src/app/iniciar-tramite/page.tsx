"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { checkRucEligibility } from "@/lib/ruc-eligibility";
import { AlertTriangle, ArrowLeft, Building2, BriefcaseBusiness, CheckCircle2, Loader2, MapPin, Search, ShieldCheck } from "lucide-react";

type TramiteExistente = {
  id: string;
  number: string;
  status: string;
  motivo: "EN_PROCESO" | "YA_TIENE_LICENCIA" | "LICENCIA_VENCIDA";
};

type RucData = {
  ruc: string;
  legalName: string;
  fiscalAddress: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  estado?: string;
  condicion?: string;
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

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function isAllowedForTrujillo(data: RucData | null) {
  if (!data) return false;

  const distrito = normalizeText(data.distrito || "");
  const provincia = normalizeText(data.provincia || "");
  const departamento = normalizeText(data.departamento || "");

  return (
    distrito === "TRUJILLO" &&
    provincia === "TRUJILLO" &&
    departamento === "LA LIBERTAD"
  );
}

export default function IniciarTramitePage() {
  const router = useRouter();

  const [ruc, setRuc] = useState("");
  const [rubro, setRubro] = useState("");
  const [correo, setCorreo] = useState("");
  const [dni, setDni] = useState("");

  // Nombre que devuelve RENIEC al completar los 8 dígitos. Es confirmación
  // visual: el servidor lo vuelve a consultar y no confía en lo que llegue.
  const [nombreDni, setNombreDni] = useState<string | null>(null);
  const [buscandoDni, setBuscandoDni] = useState(false);
  const [errorDni, setErrorDni] = useState<string | null>(null);

  /**
   * Consulta el DNI. No bloquea el trámite si falla: el formato ya está
   * validado y una caída de la API externa no puede frenar un alta.
   */
  const buscarDni = async (numero: string) => {
    setBuscandoDni(true);
    setErrorDni(null);

    try {
      const response = await fetch(`/api/dni/${numero}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo consultar el DNI.");
      }

      if (data.fullName) {
        setNombreDni(data.fullName);
      } else {
        setErrorDni("RENIEC no devolvió un nombre para ese DNI.");
      }
    } catch (error: any) {
      setErrorDni(`${error.message} Puedes continuar igual.`);
    } finally {
      setBuscandoDni(false);
    }
  };
  const [rucData, setRucData] = useState<RucData | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingApplication, setCreatingApplication] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const allowed = isAllowedForTrujillo(rucData);
  const tramiteExistente = rucData?.tramiteExistente ?? null;

  // Estado tributario: un RUC dado de baja o suspendido no puede tramitar.
  const elegibilidad = rucData
    ? checkRucEligibility(rucData)
    : { elegible: true as boolean, motivo: undefined };

  // Validación de correo pareja a la del servidor: algo@algo.algo.
  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());

  // El formato. El nombre se consulta aparte, al completar los 8 dígitos.
  //
  // Para volverlo OPCIONAL, usar esta línea en lugar de la de abajo. Deja
  // pasar el campo vacío y sigue exigiendo 8 dígitos si escriben algo:
  //
  //   const dniValido = dni.length === 0 || /^\d{8}$/.test(dni);
  //
  // Hay que hacer el cambio equivalente en el servidor
  // (src/app/api/public/iniciar-tramite/route.ts): con este solo, el
  // formulario deja continuar pero la petición vuelve con 400.
  const dniValido = /^\d{8}$/.test(dni);

  // Para volver el RUBRO opcional, usar esta línea en lugar de la de abajo.
  // Deja pasar el campo vacío y sigue exigiendo 3 caracteres si escriben algo:
  //
  //   const rubroValido = rubro.trim().length === 0 || rubro.trim().length >= 3;
  //
  // Hay que hacer el cambio equivalente en el servidor
  // (src/app/api/public/iniciar-tramite/route.ts): con este solo, el
  // formulario deja continuar pero la petición vuelve con 400.
  const rubroValido = rubro.trim().length >= 3;

  const puedeIniciar =
    Boolean(rucData) &&
    allowed &&
    !tramiteExistente &&
    elegibilidad.elegible &&
    rubroValido &&
    correoValido &&
    dniValido;

  const handleRucChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, "").slice(0, 11);

    setRuc(cleanValue);
    setRucData(null);
    setErrorMessage(null);
  };

  const handleSearch = async () => {
    const cleanRuc = ruc.trim();

    setRucData(null);
    setErrorMessage(null);

    if (!/^\d{11}$/.test(cleanRuc)) {
      setErrorMessage("Ingresa un RUC válido de 11 dígitos.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/ruc/${cleanRuc}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo consultar el RUC.");
      }

      setRucData(data);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartApplication = async () => {
    if (!rucData) {
      setErrorMessage("Primero debes consultar un RUC válido.");
      return;
    }

    if (!allowed) {
      setErrorMessage(
        "No se puede iniciar el trámite. Este sistema solo atiende establecimientos con domicilio fiscal en el distrito de Trujillo, provincia de Trujillo, departamento de La Libertad."
      );
      return;
    }

    setCreatingApplication(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/public/iniciar-tramite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ruc: rucData.ruc,
          activityType: rubro.trim(),
          contactEmail: correo.trim(),
          representativeDni: dni,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No se pudo iniciar el trámite con este RUC."
        );
      }

      if (!data.application?.id) {
        throw new Error("El servidor no devolvió el ID del trámite.");
      }

      router.push(`/tramite/${data.application.id}/subir-documentos`);
      router.refresh();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setCreatingApplication(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800 bg-slate-900/40">
        {/* El botón de inicio lo aporta GlobalHomeButton, fijo arriba a la izquierda. */}
        <div className="mx-auto flex max-w-7xl items-center justify-end px-6 py-4">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
            Trámite digital público
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <section className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.35em] text-amber-400">
              Nuevo trámite
            </p>

            <h1 className="text-3xl font-bold text-white">
              Validación de negocio por RUC
            </h1>

            <p className="mt-2 max-w-3xl text-slate-400">
              Ingresa el RUC del establecimiento. El sistema consultará los
              datos públicos y solo permitirá iniciar el trámite si el domicilio
              fiscal pertenece al distrito de Trujillo, provincia de Trujillo,
              departamento de La Libertad.
            </p>
          </div>
        </section>

        {errorMessage && (
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
          <div className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 lg:p-8">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                <BriefcaseBusiness className="h-4 w-4" />
                Paso 1: Datos del negocio
              </div>

              <h2 className="text-2xl font-bold text-white">
                Consulta y validación del RUC
              </h2>

              <p className="text-slate-400">
                Completa el RUC para autocompletar la razón social, domicilio
                fiscal y verificar si pertenece exactamente al distrito de
                Trujillo.
              </p>
            </div>

            <div className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <label className="space-y-2 text-sm text-slate-300">
                  <span className="font-semibold">RUC</span>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 transition focus-within:border-amber-500/50">
                    <input
                      value={ruc}
                      onChange={(event) => handleRucChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          handleSearch();
                        }
                      }}
                      maxLength={11}
                      type="text"
                      placeholder="Ej. 20123456789"
                      className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-500"
                    />
                  </div>
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={loading}
                    className="inline-flex h-[52px] min-w-[150px] items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Search className="h-5 w-5" />
                    )}
                    {loading ? "Buscando..." : "Buscar"}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300">
                  <span className="font-semibold">Razón social</span>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
                    <input
                      value={rucData?.legalName || ""}
                      readOnly
                      placeholder="Se autocompletará con el RUC"
                      className="w-full cursor-not-allowed bg-transparent text-slate-400 outline-none placeholder:text-slate-600"
                    />
                  </div>
                </label>

                <label className="space-y-2 text-sm text-slate-300">
                  <span className="font-semibold">Estado tributario</span>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
                    <input
                      value={rucData?.estado || ""}
                      readOnly
                      placeholder="Se autocompletará con el RUC"
                      className="w-full cursor-not-allowed bg-transparent text-slate-400 outline-none placeholder:text-slate-600"
                    />
                  </div>
                </label>
              </div>

              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-semibold">Domicilio fiscal</span>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
                  <input
                    value={rucData?.fiscalAddress || ""}
                    readOnly
                    placeholder="Se autocompletará con el RUC"
                    className="w-full cursor-not-allowed bg-transparent text-slate-400 outline-none placeholder:text-slate-600"
                  />
                </div>
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-2 text-sm text-slate-300">
                  <span className="font-semibold">Distrito</span>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
                    <input
                      value={rucData?.distrito || ""}
                      readOnly
                      placeholder="---"
                      className="w-full cursor-not-allowed bg-transparent text-slate-400 outline-none placeholder:text-slate-600"
                    />
                  </div>
                </label>

                <label className="space-y-2 text-sm text-slate-300">
                  <span className="font-semibold">Provincia</span>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
                    <input
                      value={rucData?.provincia || ""}
                      readOnly
                      placeholder="---"
                      className="w-full cursor-not-allowed bg-transparent text-slate-400 outline-none placeholder:text-slate-600"
                    />
                  </div>
                </label>

                <label className="space-y-2 text-sm text-slate-300">
                  <span className="font-semibold">Departamento</span>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
                    <input
                      value={rucData?.departamento || ""}
                      readOnly
                      placeholder="---"
                      className="w-full cursor-not-allowed bg-transparent text-slate-400 outline-none placeholder:text-slate-600"
                    />
                  </div>
                </label>
              </div>

              {/* SUNAT no devuelve el giro del negocio, así que lo declara el
                  ciudadano. Va impreso en la licencia. */}
              <label className="block text-sm text-slate-300">
                <span className="font-semibold">
                  Rubro o giro del negocio{" "}
                  <span className="text-rose-400">*</span>
                </span>

                <input
                  value={rubro}
                  onChange={(event) => setRubro(event.target.value)}
                  maxLength={80}
                  placeholder="Ej. Bodega, restaurante, ferretería"
                  className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-slate-100 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Obligatorio. Aparecerá en tu licencia como giro comercial.
                </p>
              </label>

              {/* El ciudadano del flujo público no puede iniciar sesión, así
                  que este correo es la vía para avisarle del vencimiento y de
                  la inspección. */}
              <label className="block text-sm text-slate-300">
                <span className="font-semibold">
                  Correo de contacto <span className="text-rose-400">*</span>
                </span>

                <input
                  type="email"
                  value={correo}
                  onChange={(event) => setCorreo(event.target.value)}
                  maxLength={120}
                  placeholder="tucorreo@ejemplo.com"
                  className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-slate-100 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Obligatorio. Te avisaremos aquí cuando tu licencia esté por
                  vencer y el día de tu inspección.
                </p>

                {correo.trim().length > 0 && !correoValido && (
                  <p className="mt-1 text-xs text-amber-300">
                    Ingresa un correo válido.
                  </p>
                )}
              </label>

              {/* Identifica al titular en la licencia. Al completar los 8
                  dígitos se consulta RENIEC y se muestra el nombre, igual que
                  con el RUC. El servidor lo vuelve a resolver por su cuenta:
                  este nombre es solo para que la persona confirme que es
                  quien cree. */}
              <label className="block text-sm text-slate-300">
                <span className="font-semibold">
                  DNI del representante legal{" "}
                  <span className="text-rose-400">*</span>
                </span>

                <input
                  value={dni}
                  onChange={(event) => {
                    const limpio = event.target.value.replace(/\D/g, "").slice(0, 8);
                    setDni(limpio);
                    setNombreDni(null);
                    setErrorDni(null);
                    if (limpio.length === 8) buscarDni(limpio);
                  }}
                  inputMode="numeric"
                  placeholder="8 dígitos"
                  className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-slate-100 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                />

                {buscandoDni && (
                  <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Consultando RENIEC...
                  </p>
                )}

                {nombreDni && (
                  <p className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    {nombreDni}
                  </p>
                )}

                {/* No bloquea: si RENIEC no responde, el trámite sigue y la
                    licencia imprime solo el número. */}
                {errorDni && (
                  <p className="mt-2 text-xs text-amber-300">{errorDni}</p>
                )}

                <p className="mt-2 text-xs text-slate-500">
                  Obligatorio. Aparecerá impreso en tu licencia para identificar
                  al titular. Puede ser una persona distinta al titular del RUC.
                </p>

                {dni.length > 0 && !dniValido && (
                  <p className="mt-1 text-xs text-amber-300">
                    El DNI debe tener 8 dígitos.
                  </p>
                )}
              </label>

              {/* El estado tributario se evalúa antes que la jurisdicción: si
                  el RUC está de baja, el distrito es irrelevante. */}
              {rucData && !elegibilidad.elegible && (
                <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />

                    <div>
                      <p className="font-bold">
                        RUC no habilitado ante SUNAT
                      </p>

                      <p className="mt-2 text-sm">{elegibilidad.motivo}</p>

                      <p className="mt-2 text-xs text-rose-300/80">
                        Estado tributario:{" "}
                        <strong>{rucData.estado || "No registrado"}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {rucData && elegibilidad.elegible && (
                <div
                  className={`rounded-3xl border p-5 ${
                    allowed
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {allowed ? (
                      <CheckCircle2 className="mt-1 h-5 w-5 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
                    )}

                    <div>
                      <p className="font-bold">
                        {allowed
                          ? "RUC válido para iniciar trámite"
                          : "RUC fuera de jurisdicción"}
                      </p>

                      <p className="mt-2 text-sm">
                        {allowed
                          ? "El domicilio fiscal pertenece al distrito de Trujillo, provincia de Trujillo, departamento de La Libertad. Puedes continuar con el trámite."
                          : "No se puede iniciar el trámite. Este sistema solo atiende establecimientos con domicilio fiscal en el distrito de Trujillo, provincia de Trujillo, departamento de La Libertad."}
                      </p>

                    </div>
                  </div>
                </div>
              )}

              {tramiteExistente && (
                <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />

                    <div>
                      <p className="font-bold text-amber-200">
                        {tramiteExistente.motivo === "EN_PROCESO"
                          ? "Este RUC ya tiene un trámite en proceso"
                          : "Este RUC ya cuenta con una licencia vigente"}
                      </p>

                      <p className="mt-2 text-sm leading-relaxed text-amber-100/80">
                        Trámite{" "}
                        <span className="font-mono font-bold text-amber-200">
                          {tramiteExistente.number}
                        </span>{" "}
                        · Estado:{" "}
                        <span className="font-bold text-amber-200">
                          {ETIQUETAS_ESTADO[tramiteExistente.status] ??
                            tramiteExistente.status.replaceAll("_", " ")}
                        </span>
                      </p>

                      <p className="mt-2 text-sm text-amber-100/70">
                        {tramiteExistente.motivo === "EN_PROCESO"
                          ? "No puedes iniciar otro trámite para el mismo RUC hasta que este finalice."
                          : "No corresponde iniciar un trámite nuevo mientras la licencia esté vigente."}
                      </p>

                      <Link
                        href={`/tramite/${tramiteExistente.id}/subir-documentos`}
                        className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/20 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/30"
                      >
                        Ver mi trámite
                        <ArrowLeft className="h-4 w-4 rotate-180" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-500">
                  Solo se permite iniciar trámites para establecimientos cuyo
                  domicilio fiscal sea: distrito Trujillo, provincia Trujillo,
                  departamento La Libertad.
                </div>

                <button
                  type="button"
                  onClick={handleStartApplication}
                  disabled={!puedeIniciar || creatingApplication}
                  className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {creatingApplication
                    ? "Iniciando trámite..."
                    : tramiteExistente
                    ? "Trámite ya iniciado"
                    : "Iniciar trámite y subir documentos"}
                </button>
              </div>
            </div>
          </div>

          <aside className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 lg:p-8">
            <div className="rounded-[2rem] border border-slate-800 bg-slate-950/70 p-5">
              <div className="mb-4 flex items-center gap-3 text-amber-300">
                <ShieldCheck className="h-5 w-5" />
                <h3 className="text-base font-bold text-white">
                  Validación municipal
                </h3>
              </div>

              <div className="space-y-4 text-sm text-slate-400">
                <p>Antes de iniciar el trámite se verificará:</p>

                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="mt-1 text-amber-400">•</span>
                    <span>RUC existente y activo en APIPERU/SUNAT.</span>
                  </li>

                  <li className="flex items-start gap-3">
                    <span className="mt-1 text-amber-400">•</span>
                    <span>Distrito exactamente igual a TRUJILLO.</span>
                  </li>

                  <li className="flex items-start gap-3">
                    <span className="mt-1 text-amber-400">•</span>
                    <span>Provincia TRUJILLO y departamento LA LIBERTAD.</span>
                  </li>

                  <li className="flex items-start gap-3">
                    <span className="mt-1 text-amber-400">•</span>
                    <span>Razón social y dirección fiscal autocompletadas.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-800 bg-slate-950/70 p-5">
              <div className="mb-4 flex items-center gap-3 text-amber-300">
                <MapPin className="h-5 w-5" />
                <h3 className="text-base font-bold text-white">
                  Resultado de jurisdicción
                </h3>
              </div>

              {!rucData ? (
                <p className="text-sm leading-6 text-slate-400">
                  Ingresa un RUC para conocer si el negocio pertenece al
                  distrito de Trujillo.
                </p>
              ) : (
                <div
                  className={`rounded-2xl border p-4 text-sm ${
                    allowed
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                  }`}
                >
                  <p className="font-bold">
                    {allowed ? "APTO PARA TRÁMITE" : "NO APTO PARA TRÁMITE"}
                  </p>

                  <p className="mt-2">
                    Distrito detectado:{" "}
                    <span className="font-semibold">
                      {rucData.distrito || "No registrado"}
                    </span>
                  </p>

                  <p className="mt-1">
                    Provincia detectada:{" "}
                    <span className="font-semibold">
                      {rucData.provincia || "No registrado"}
                    </span>
                  </p>

                  <p className="mt-1">
                    Departamento detectado:{" "}
                    <span className="font-semibold">
                      {rucData.departamento || "No registrado"}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[2rem] border border-slate-800 bg-slate-950/70 p-5">
                <div className="mb-3 flex items-center gap-3 text-amber-300">
                  <Building2 className="h-5 w-5" />
                  <h3 className="text-sm font-bold text-white">
                    Datos públicos
                  </h3>
                </div>

                <p className="text-sm leading-6 text-slate-400">
                  La información se obtiene desde la API pública configurada en
                  el sistema.
                </p>
              </div>

              <div className="rounded-[2rem] border border-slate-800 bg-slate-950/70 p-5">
                <div className="mb-3 flex items-center gap-3 text-amber-300">
                  <MapPin className="h-5 w-5" />
                  <h3 className="text-sm font-bold text-white">
                    Jurisdicción
                  </h3>
                </div>

                <p className="text-sm leading-6 text-slate-400">
                  Si el negocio pertenece a otro distrito, el sistema bloquea el
                  inicio del trámite.
                </p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}