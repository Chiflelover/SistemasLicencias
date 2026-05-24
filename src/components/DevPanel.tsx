"use client";

import { useEffect, useState } from "react";
import { Sparkles, CalendarDays, ChevronRight, ChevronLeft, Zap, Info } from "lucide-react";

export default function DevPanel() {
  const [collapsed, setCollapsed] = useState(true);
  const [simulatedDate, setSimulatedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCurrentSystemDate = async () => {
    try {
      const response = await fetch("/api/system/date");
      if (!response.ok) throw new Error("Error al obtener fecha del sistema");
      const data = await response.json();
      setSimulatedDate(new Date(data.currentSystemDate));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchCurrentSystemDate();
  }, []);

  const handleAdvanceTime = async (amount: number, unit: "days" | "years") => {
    setLoading(true);
    try {
      const response = await fetch("/api/system/date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit, amount }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error || "No se pudo avanzar la fecha.");
      }
      const data = await response.json();
      setSimulatedDate(new Date(data.currentSystemDate));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold p-3.5 rounded-full shadow-2xl flex items-center justify-center gap-2 border border-amber-400 group transition duration-200 transform hover:scale-105 cursor-pointer"
          title="Abrir Simulador de Tiempo DEV"
        >
          <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          <span className="text-xs font-extrabold pr-1">DEV SIMULATOR</span>
        </button>
      ) : (
        <div className="w-80 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-4 space-y-4 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-850">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="font-extrabold text-white text-xs tracking-wider uppercase">SIMULADOR ACADÉMICO</span>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              className="text-slate-500 hover:text-slate-300 text-xs font-semibold p-1 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Ocultar
            </button>
          </div>

          {/* Fecha Actual Simulada */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-850 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CalendarDays className="w-5 h-5 text-amber-500" />
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">FECHA DEL DEMO</span>
                <span className="text-sm font-extrabold text-amber-400 tracking-wide">
                  {simulatedDate ? formatDate(simulatedDate) : "Cargando..."}
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[8px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-extrabold uppercase">
              ACTIVO
            </span>
          </div>

          {/* Botones de Control de Tiempo */}
          <div className="space-y-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">AVANZAR TIEMPO</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleAdvanceTime(1, "days")}
                disabled={loading || !simulatedDate}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold py-2 px-1 rounded-lg border border-slate-750 transition hover:border-slate-600 disabled:cursor-not-allowed disabled:opacity-50 text-center"
              >
                +1 Día
              </button>
              <button
                onClick={() => handleAdvanceTime(30, "days")}
                disabled={loading || !simulatedDate}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold py-2 px-1 rounded-lg border border-slate-750 transition hover:border-slate-600 disabled:cursor-not-allowed disabled:opacity-50 text-center"
              >
                +30 Días
              </button>
              <button
                onClick={() => handleAdvanceTime(1, "years")}
                disabled={loading || !simulatedDate}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-extrabold py-2 px-1 rounded-lg transition transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 text-center"
              >
                +1 Año
              </button>
            </div>
          </div>

          {/* Caja Informativa */}
          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-850/50 flex gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-500 leading-normal">
              Esta herramienta permite acelerar el calendario de la demo académica para simular vencimientos, renovaciones y el programador de inspecciones de lunes a viernes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
