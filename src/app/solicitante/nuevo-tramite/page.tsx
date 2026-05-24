"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Briefcase, MapPin, Home, ClipboardCopy, Layers } from "lucide-react";
import { BusinessSchema, type BusinessFormValues } from "@/lib/validation/business";

export default function NuevoTramitePage() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BusinessFormValues>({
    resolver: zodResolver(BusinessSchema),
    defaultValues: {
      legalName: "",
      ruc: "",
      fiscalAddress: "",
      commercialAddress: "",
      activityType: "",
      representativeName: "",
    },
  });

  const onSubmit = async (values: BusinessFormValues) => {
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/solicitante/nuevo-tramite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.error || "No se pudo guardar el negocio. Intenta de nuevo.");
        return;
      }

      setSuccessMessage("Registro guardado correctamente en la base de datos.");
      reset();
    } catch (error) {
      setErrorMessage("Ocurrió un error al conectar con el servidor. Intenta otra vez.");
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/40 p-6 rounded-3xl border border-slate-850">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-amber-400 font-semibold mb-2">Nuevo trámite</p>
          <h1 className="text-3xl font-bold text-white">Registro de negocio</h1>
          <p className="mt-2 text-slate-400 max-w-2xl">
            Completa los datos de tu empresa para iniciar el proceso de licencia municipal.
          </p>
        </div>

        <Link
          href="/solicitante"
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 hover:border-amber-500 hover:text-amber-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
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
        <section className="space-y-6 bg-slate-900/40 border border-slate-850 rounded-3xl p-6 lg:p-8">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-300 font-semibold">
              <Layers className="w-4 h-4" />
              Paso 1: Datos del negocio
            </div>
            <h2 className="text-2xl font-bold text-white">Formulario de registro</h2>
            <p className="text-slate-400">
              Ingresa la información solicitada. Todos los campos son obligatorios.
            </p>
          </div>

          <form className="grid gap-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-semibold">Razón social</span>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <input
                    {...register("legalName")}
                    type="text"
                    placeholder="Ej. Inversiones Trujillo S.A.C."
                    className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </div>
                {errors.legalName && <p className="text-xs text-rose-400">{errors.legalName.message}</p>}
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-semibold">RUC</span>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <input
                    {...register("ruc")}
                    type="text"
                    placeholder="20123456789"
                    maxLength={11}
                    className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </div>
                {errors.ruc && <p className="text-xs text-rose-400">{errors.ruc.message}</p>}
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-semibold">Domicilio fiscal</span>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <input
                    {...register("fiscalAddress")}
                    type="text"
                    placeholder="Av. España 123, Trujillo"
                    className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </div>
                {errors.fiscalAddress && <p className="text-xs text-rose-400">{errors.fiscalAddress.message}</p>}
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-semibold">Dirección local</span>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <input
                    {...register("commercialAddress")}
                    type="text"
                    placeholder="Jr. San Martín 456, Local 7"
                    className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </div>
                {errors.commercialAddress && <p className="text-xs text-rose-400">{errors.commercialAddress.message}</p>}
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-semibold">Rubro</span>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <input
                    {...register("activityType")}
                    type="text"
                    placeholder="Comercio minorista, Restaurant, Servicios"
                    className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </div>
                {errors.activityType && <p className="text-xs text-rose-400">{errors.activityType.message}</p>}
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-semibold">Representante legal</span>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <input
                    {...register("representativeName")}
                    type="text"
                    placeholder="Nombre completo del representante"
                    className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </div>
                {errors.representativeName && <p className="text-xs text-rose-400">{errors.representativeName.message}</p>}
              </label>
            </div>

            <div className="space-y-3 rounded-3xl border border-slate-850 bg-slate-950/40 p-5">
              <div className="flex items-center gap-3 text-slate-300">
                <ClipboardCopy className="w-5 h-5 text-amber-400" />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500">
                Consejo: revisa tus datos antes de avanzar al siguiente paso.
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Guardando..." : "Guardar datos"}
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-6 rounded-3xl border border-slate-850 bg-slate-900/40 p-6 lg:p-8">
          <div className="rounded-[2rem] bg-slate-950/70 p-5 border border-slate-850">
            <div className="flex items-center gap-3 mb-4 text-amber-300">
              <Briefcase className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Resumen de datos</h3>
            </div>
            <div className="space-y-4 text-slate-400 text-sm">
              <p>Estos son los datos que se requieren para el registro del negocio:</p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-amber-400">•</span>
                  <span>Razón social de la empresa.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-amber-400">•</span>
                  <span>RUC de 11 dígitos.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-amber-400">•</span>
                  <span>Domicilio fiscal registrado en SUNAT.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-amber-400">•</span>
                  <span>Dirección exacta del local comercial.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-amber-400">•</span>
                  <span>Rubro o actividad económica principal.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-amber-400">•</span>
                  <span>Representante legal a cargo del trámite.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-850 bg-slate-950/60 p-5">
              <div className="flex items-center gap-3 text-slate-200 mb-3">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-sm">Domicilio fiscal</span>
              </div>
              <p className="text-sm text-slate-400">Debe coincidir con tu dirección registrada en SUNAT para evitar observaciones.</p>
            </div>
            <div className="rounded-3xl border border-slate-850 bg-slate-950/60 p-5">
              <div className="flex items-center gap-3 text-slate-200 mb-3">
                <Home className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-sm">Dirección local</span>
              </div>
              <p className="text-sm text-slate-400">
                Incluye el número de local, piso o referencia para la inspección física posterior.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
