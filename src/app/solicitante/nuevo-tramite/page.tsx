"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Layers,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  BusinessSchema,
  type BusinessFormValues,
} from "@/lib/validation/business";

type RucApiData = {
  ruc: string;
  legalName: string;
  fiscalAddress: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  estado?: string;
  condicion?: string;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function isTrujilloDistrict(data: RucApiData | null) {
  if (!data) return false;

  const distrito = normalizeText(data.distrito || "");
  const provincia = normalizeText(data.provincia || "");
  const departamento = normalizeText(data.departamento || "");
  const address = normalizeText(data.fiscalAddress || "");

  return (
    distrito === "TRUJILLO" ||
    (address.includes("TRUJILLO") &&
      provincia.includes("TRUJILLO") &&
      departamento.includes("LA LIBERTAD"))
  );
}

export default function NuevoTramitePage() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFetchingRuc, setIsFetchingRuc] = useState(false);
  const [rucData, setRucData] = useState<RucApiData | null>(null);
  const [isAllowedDistrict, setIsAllowedDistrict] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<BusinessFormValues>({
    resolver: zodResolver(BusinessSchema),
    defaultValues: {
      legalName: "",
      ruc: "",
      fiscalAddress: "",
    },
  });

  const rucValue = watch("ruc")?.trim();

  useEffect(() => {
    let isMounted = true;

    const fetchRucData = async (ruc: string) => {
      setIsFetchingRuc(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setRucData(null);
      setIsAllowedDistrict(false);

      try {
        const response = await fetch(`/api/ruc/${ruc}`, {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "No se encontró información para el RUC proporcionado."
          );
        }

        if (!isMounted) return;

        const apiData = data as RucApiData;
        const allowed = isTrujilloDistrict(apiData);

        setRucData(apiData);
        setIsAllowedDistrict(allowed);

        setValue("legalName", apiData.legalName, { shouldValidate: true });
        setValue("fiscalAddress", apiData.fiscalAddress, {
          shouldValidate: true,
        });

        clearErrors(["legalName", "ruc", "fiscalAddress"]);

        if (!allowed) {
          const districtMessage = `No se puede iniciar el trámite. El domicilio fiscal pertenece a ${
            apiData.distrito || "otro distrito"
          }, no al distrito de Trujillo.`;

          setErrorMessage(districtMessage);
          setError("ruc", {
            type: "manual",
            message: districtMessage,
          });
        }
      } catch (err: any) {
        if (!isMounted) return;

        setErrorMessage(err.message);
        setError("ruc", { type: "manual", message: err.message });

        setValue("legalName", "");
        setValue("fiscalAddress", "");
        setRucData(null);
        setIsAllowedDistrict(false);
      } finally {
        if (isMounted) {
          setIsFetchingRuc(false);
        }
      }
    };

    if (rucValue?.length === 11 && /^\d+$/.test(rucValue)) {
      fetchRucData(rucValue);
    } else {
      setValue("legalName", "");
      setValue("fiscalAddress", "");
      setRucData(null);
      setIsAllowedDistrict(false);

      if (rucValue && rucValue.length > 0 && rucValue.length < 11) {
        setErrorMessage(null);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [rucValue, setValue, setError, clearErrors]);

  const onSubmit = async (values: BusinessFormValues) => {
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!rucData) {
      setErrorMessage("Primero debes consultar un RUC válido.");
      return;
    }

    if (!isAllowedDistrict) {
      setErrorMessage(
        "No se puede iniciar el trámite porque el domicilio fiscal no pertenece al distrito de Trujillo."
      );
      return;
    }

    try {
      const response = await fetch("/api/solicitante/nuevo-tramite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(
          result.error || "No se pudo iniciar el trámite. Intenta de nuevo."
        );
        return;
      }

      setSuccessMessage(
        "Trámite iniciado correctamente. Ahora puedes subir tus documentos."
      );

      reset();
      setRucData(null);
      setIsAllowedDistrict(false);
    } catch {
      setErrorMessage(
        "Ocurrió un error al conectar con el servidor. Intenta otra vez."
      );
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-850 bg-slate-900/40 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.35em] text-amber-400">
            Nuevo trámite
          </p>

          <h1 className="text-3xl font-bold text-white">
            Iniciar trámite con RUC
          </h1>

          <p className="mt-2 max-w-2xl text-slate-400">
            Ingresa el RUC del negocio. El sistema consultará APIPERU y solo
            permitirá iniciar el trámite si el domicilio fiscal pertenece al
            distrito de Trujillo.
          </p>
        </div>

        <Link
          href="/solicitante"
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-amber-500 hover:text-amber-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al panel
        </Link>
      </div>

      {successMessage && (
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
        <section className="space-y-6 rounded-3xl border border-slate-850 bg-slate-900/40 p-6 lg:p-8">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
              <Layers className="h-4 w-4" />
              Paso 1: Validación del RUC
            </div>

            <h2 className="text-2xl font-bold text-white">
              Consulta y validación del negocio
            </h2>

            <p className="text-slate-400">
              El RUC se valida automáticamente al completar los 11 dígitos.
            </p>
          </div>

          <form className="grid gap-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-semibold">RUC</span>

                <div className="relative rounded-2xl border border-slate-800 bg-slate-950/70 p-3 transition focus-within:border-amber-500/50">
                  <input
                    {...register("ruc")}
                    type="text"
                    placeholder="20123456789"
                    maxLength={11}
                    className="w-full bg-transparent pr-10 text-slate-100 outline-none placeholder:text-slate-500"
                  />

                  {isFetchingRuc && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                    </div>
                  )}
                </div>

                {errors.ruc && (
                  <p className="text-xs text-rose-400">{errors.ruc.message}</p>
                )}
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-semibold">Razón social</span>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
                  <input
                    {...register("legalName")}
                    type="text"
                    readOnly
                    placeholder="Se autocompletará con el RUC"
                    className="w-full cursor-not-allowed bg-transparent text-slate-400 outline-none placeholder:text-slate-600"
                  />
                </div>

                {errors.legalName && (
                  <p className="text-xs text-rose-400">
                    {errors.legalName.message}
                  </p>
                )}
              </label>
            </div>

            <label className="space-y-2 text-sm text-slate-300">
              <span className="font-semibold">Domicilio fiscal</span>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
                <input
                  {...register("fiscalAddress")}
                  type="text"
                  readOnly
                  placeholder="Se autocompletará con el RUC"
                  className="w-full cursor-not-allowed bg-transparent text-slate-400 outline-none placeholder:text-slate-600"
                />
              </div>

              {errors.fiscalAddress && (
                <p className="text-xs text-rose-400">
                  {errors.fiscalAddress.message}
                </p>
              )}
            </label>

            {rucData && (
              <div
                className={`rounded-3xl border p-5 ${
                  isAllowedDistrict
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  {isAllowedDistrict ? (
                    <CheckCircle2 className="mt-1 h-5 w-5 shrink-0" />
                  ) : (
                    <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
                  )}

                  <div>
                    <p className="font-bold">
                      {isAllowedDistrict
                        ? "RUC válido para iniciar trámite"
                        : "RUC fuera del distrito permitido"}
                    </p>

                    <p className="mt-2 text-sm">
                      Distrito:{" "}
                      <span className="font-semibold">
                        {rucData.distrito || "No registrado"}
                      </span>
                    </p>

                    <p className="text-sm">
                      Provincia:{" "}
                      <span className="font-semibold">
                        {rucData.provincia || "No registrado"}
                      </span>
                    </p>

                    <p className="text-sm">
                      Departamento:{" "}
                      <span className="font-semibold">
                        {rucData.departamento || "No registrado"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500">
                Solo se permite iniciar trámite para negocios con domicilio
                fiscal en Trujillo.
              </div>

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  isFetchingRuc ||
                  !rucData ||
                  !isAllowedDistrict
                }
                className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting
                  ? "Iniciando..."
                  : isFetchingRuc
                  ? "Verificando RUC..."
                  : "Iniciar trámite"}
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-6 rounded-3xl border border-slate-850 bg-slate-900/40 p-6 lg:p-8">
          <div className="rounded-[2rem] border border-slate-850 bg-slate-950/70 p-5">
            <div className="mb-4 flex items-center gap-3 text-amber-300">
              <Briefcase className="h-5 w-5" />
              <h3 className="text-base font-bold text-white">
                Requisitos del trámite
              </h3>
            </div>

            <div className="space-y-4 text-sm text-slate-400">
              <p>Para iniciar el trámite se validará:</p>

              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-amber-400">•</span>
                  <span>RUC activo y existente en APIPERU/SUNAT.</span>
                </li>

                <li className="flex items-start gap-3">
                  <span className="mt-1 text-amber-400">•</span>
                  <span>Domicilio fiscal dentro del distrito de Trujillo.</span>
                </li>

                <li className="flex items-start gap-3">
                  <span className="mt-1 text-amber-400">•</span>
                  <span>Razón social y dirección fiscal autocompletadas.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-850 bg-slate-950/70 p-5">
            <div className="mb-4 flex items-center gap-3 text-amber-300">
              <MapPin className="h-5 w-5" />
              <h3 className="text-base font-bold text-white">
                Validación territorial
              </h3>
            </div>

            <p className="text-sm leading-6 text-slate-400">
              Si el domicilio fiscal pertenece a otro distrito, el sistema
              bloqueará el inicio del trámite para cumplir con la jurisdicción
              de la Municipalidad Provincial de Trujillo.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}