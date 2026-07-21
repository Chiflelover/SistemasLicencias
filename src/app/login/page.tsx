"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";

// Esquema de validación con Zod
const loginSchema = z.object({
  email: z.string().email("Debe ingresar un correo electrónico válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(responsePayload(data)),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Algo salió mal.");
      }

      // Redireccionar según el rol del usuario. Solo el personal inicia
      // sesión: el administrado entra por el flujo público, sin cuenta.
      if (result.user.role === "INSPECTOR") {
        router.push("/inspector");
      } else if (result.user.role === "CAJERO") {
        router.push("/cajero");
      } else if (result.user.role === "ADMIN") {
        router.push("/admin");
      } else if (result.user.role === "DEVELOPER") {
        router.push("/dev");
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper para normalizar el payload
  const responsePayload = (data: LoginFormValues) => {
    return {
      email: data.email.toLowerCase().trim(),
      password: data.password,
    };
  };

  return (
    <main className="flex min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100">
      {/* Solo el formulario, centrado: el acceso es para el personal y no
          necesita presentación institucional. */}
      <div className="w-full flex items-center justify-center p-6 sm:p-12 md:p-16">
        <div className="w-full max-w-md space-y-8 bg-slate-900/40 backdrop-blur-md p-8 rounded-2xl border border-slate-800 shadow-2xl">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-white tracking-tight">Iniciar Sesión</h2>
            <p className="text-slate-400">Ingresa tus credenciales para acceder al sistema</p>
          </div>

          {error && (
            <div className="p-4 text-sm bg-red-950/50 border border-red-500/30 text-red-300 rounded-lg animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Input Correo */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 block" htmlFor="email">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  placeholder="ejemplo@muni.pe"
                  disabled={isLoading}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Input Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-slate-300 block" htmlFor="password">
                  Contraseña
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                  {...register("password")}
                />
              </div>
              {errors.password && (
                <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Botón de Enviar */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-600/40 text-slate-950 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition duration-200 transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Cargando...
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
