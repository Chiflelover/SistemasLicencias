"use client";

import { Shield, Calendar, Clock, ChevronDown, User, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface NavbarProps {
  userName: string;
  email: string;
  role: "APPLICANT" | "INSPECTOR";
}

export default function Navbar({ userName, email, role }: NavbarProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [systemDate, setSystemDate] = useState<string>("");

  const fetchSystemDate = async () => {
    try {
      const response = await fetch("/api/system/date");
      if (!response.ok) return;
      const data = await response.json();
      const date = new Date(data.currentSystemDate);
      setSystemDate(date.toLocaleDateString("es-PE"));
    } catch {
      setSystemDate("--/--/----");
    }
  };

  useEffect(() => {
    fetchSystemDate();
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-900 border-b border-slate-850 flex items-center justify-between px-6 lg:px-8">
      {/* Lado Izquierdo: Contexto */}
      <div className="flex items-center gap-3">
        {/* Espacio para que el botón de menú móvil no se sobreponga */}
        <div className="w-12 lg:hidden" />
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 font-semibold">
          <Shield className="w-3.5 h-3.5 text-amber-500" />
          CONEXIÓN CIFRADA (SSL)
        </span>
      </div>

      {/* Lado Derecho: Fecha Simulada + Usuario */}
      <div className="flex items-center gap-4">
        {/* Indicador de Fecha Simulada */}
        <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3.5 py-1.5 rounded-lg text-xs font-semibold">
          <Calendar className="w-4 h-4" />
          <span className="hidden md:inline">FECHA DEL SISTEMA:</span>
          <span>{systemDate || "Cargando..."}</span>
        </div>
        <div className="h-6 w-px bg-slate-800 hidden sm:block" />

        {/* Dropdown de Usuario */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-1 px-2.5 rounded-lg hover:bg-slate-800/80 transition duration-150 text-slate-200 cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 text-xs font-bold uppercase">
              {userName.substring(0, 2)}
            </div>
            <span className="hidden sm:inline text-xs font-semibold max-w-[120px] truncate">{userName}</span>
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </button>

          {/* Menú Flotante */}
          {dropdownOpen && (
            <>
              <div
                onClick={() => setDropdownOpen(false)}
                className="fixed inset-0 z-30"
              />
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-40 p-1.5 animate-fadeIn">
                <div className="px-3 py-2 border-b border-slate-850">
                  <p className="text-xs font-semibold text-slate-200 truncate">{userName}</p>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{email}</p>
                </div>
                
                <div className="py-1">
                  <div className="px-3 py-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Panel
                  </div>
                  <div className="px-3 py-1 text-xs text-slate-300 font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Sesión Activa ({role === "INSPECTOR" ? "Inspector" : "Solicitante"})
                  </div>
                </div>

                <div className="border-t border-slate-850 pt-1 mt-1">
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full text-left px-3 py-2 hover:bg-red-950/40 text-xs font-semibold text-red-400 hover:text-red-300 rounded-lg flex items-center gap-2 transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    {isLoggingOut ? "Cerrando..." : "Cerrar Sesión"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
