"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, User, Mail, Phone, Hash, Lock, Loader2, ArrowRight } from "lucide-react";

// Esquema de validación con Zod
const registerSchema = z
  .object({
    fullName: z.string().min(3, "El nombre completo debe tener al menos 3 caracteres"),
    email: z.string().email("Debe ingresar un correo electrónico válido"),
    dni: z
      .string()
      .length(8, "El DNI debe tener exactamente 8 dígitos")
      .regex(/^\d+$/, "El DNI debe contener solo números"),
    phone: z
      .string()
      .min(9, "El teléfono debe tener al menos 9 dígitos")
      .regex(/^\+?\d+$/, "El número de teléfono no es válido"),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmPassword: z.string().min(1, "Debe confirmar su contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email.toLowerCase().trim(),
          password: data.password,
          fullName: data.fullName.trim(),
          dni: data.dni.trim(),
          phone: data.phone.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Algo salió mal durante el registro.");
      }

      // Redireccionar al portal del solicitante tras registrarse exitosamente
      router.push("/solicitante");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al registrar la cuenta.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100">
      {/* Lado Izquierdo: Mensaje de Bienvenida (Oculto en móviles) */}
      <div
        className="hidden lg:flex lg:w-5/12 relative items-center justify-center p-12 overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.95))" }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/30 to-amber-500/10 pointer-events-none" />
        <div className="z-10 max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium">
            <Shield className="w-4 h-4" />
            Registro de Ciudadanos
          </div>
          <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight tracking-tight text-white">
            Crea tu cuenta de Solicitante en segundos
          </h1>
          <p className="text-base text-slate-300">
            Al registrarte en la plataforma digital de la Municipalidad Provincial de Trujillo, podrás iniciar solicitudes de licencia para tus locales comerciales de forma inmediata.
          </p>
          <ul className="space-y-3 text-sm text-slate-400">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Ingresa tus datos personales reales (DNI)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Sube tus planos en formatos PDF/PNG/JPG
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Realiza el pago de la tasa única de S/ 2
            </li>
          </ul>
        </div>
      </div>

      {/* Lado Derecho: Formulario */}
      <div className="w-full lg:w-7/12 flex items-center justify-center p-6 sm:p-12 md:p-16">
        <div className="w-full max-w-lg space-y-6 bg-slate-900/40 backdrop-blur-md p-8 rounded-2xl border border-slate-800 shadow-2xl">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-white tracking-tight">Crear Cuenta</h2>
            <p className="text-slate-400 text-sm">Completa tus datos para registrarte como solicitante</p>
          </div>

          {error && (
            <div className="p-3 text-sm bg-red-950/50 border border-red-500/30 text-red-300 rounded-lg animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nombre Completo */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-slate-300 block" htmlFor="fullName">
                  Nombres y Apellidos Completos
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="fullName"
                    type="text"
                    placeholder="Juan Pérez Quispe"
                    disabled={isLoading}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                    {...register("fullName")}
                  />
                </div>
                {errors.fullName && (
                  <p className="text-xs text-red-400 mt-0.5">{errors.fullName.message}</p>
                )}
              </div>

              {/* Correo Electrónico */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block" htmlFor="email">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    placeholder="juan@correo.com"
                    disabled={isLoading}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-400 mt-0.5">{errors.email.message}</p>
                )}
              </div>

              {/* Teléfono */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block" htmlFor="phone">
                  Teléfono / Celular
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    id="phone"
                    type="text"
                    placeholder="987654321"
                    maxLength={15}
                    disabled={isLoading}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                    {...register("phone")}
                  />
                </div>
                {errors.phone && (
                  <p className="text-xs text-red-400 mt-0.5">{errors.phone.message}</p>
                )}
              </div>

              {/* DNI */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block" htmlFor="dni">
                  DNI (8 dígitos)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Hash className="w-4 h-4" />
                  </div>
                  <input
                    id="dni"
                    type="text"
                    maxLength={8}
                    placeholder="12345678"
                    disabled={isLoading}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                    {...register("dni")}
                  />
                </div>
                {errors.dni && (
                  <p className="text-xs text-red-400 mt-0.5">{errors.dni.message}</p>
                )}
              </div>

              <div className="hidden sm:block" />

              {/* Contraseña */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block" htmlFor="password">
                  Contraseña (mín. 8 caracteres)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    disabled={isLoading}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                    {...register("password")}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-red-400 mt-0.5">{errors.password.message}</p>
                )}
              </div>

              {/* Confirmar Contraseña */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block" htmlFor="confirmPassword">
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    disabled={isLoading}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                    {...register("confirmPassword")}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-red-400 mt-0.5">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>

            {/* Botón de Enviar */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-600/40 text-slate-950 font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition duration-200 mt-4 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  Crear Cuenta
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-1 border-t border-slate-800/80">
            <p className="text-xs text-slate-400">
              ¿Ya tienes una cuenta registrada?{" "}
              <Link
                href="/login"
                className="text-amber-400 hover:text-amber-300 font-medium hover:underline transition"
              >
                Inicia sesión aquí
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
