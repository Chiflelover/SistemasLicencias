"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  FileWarning,
  Loader2,
  ShieldAlert,
  CalendarDays,
} from "lucide-react";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  applicationId: string | null;
  readAt: string | null;
  createdAt: string;
}

const ICONOS: Record<string, typeof Bell> = {
  INSPECTION_TODAY: CalendarDays,
  INSPECTION_RESCHEDULED: CalendarClock,
  DOCUMENTS_TO_FIX: FileWarning,
  LICENSE_EXPIRED: ShieldAlert,
  INSPECTOR_TODAY_AGENDA: CalendarDays,
  INSPECTOR_NEW_ASSIGNMENT: CalendarClock,
};

export default function NotificationBell() {
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [sinLeer, setSinLeer] = useState(0);
  const [cargando, setCargando] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    setCargando(true);

    try {
      const response = await fetch("/api/notificaciones", { cache: "no-store" });

      if (!response.ok) return;

      const data = await response.json();
      setItems(data.notifications || []);
      setSinLeer(data.unreadCount || 0);
    } catch {
      // La campana no debe romper la página si falla la consulta.
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Cerrar al hacer clic fuera del panel.
  useEffect(() => {
    if (!abierto) return;

    const alClicar = (evento: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(evento.target as Node)) {
        setAbierto(false);
      }
    };

    document.addEventListener("mousedown", alClicar);
    return () => document.removeEventListener("mousedown", alClicar);
  }, [abierto]);

  const marcarLeida = async (id: string) => {
    setItems((previo) =>
      previo.map((item) =>
        item.id === id && !item.readAt
          ? { ...item, readAt: new Date().toISOString() }
          : item
      )
    );
    setSinLeer((previo) => Math.max(0, previo - 1));

    await fetch(`/api/notificaciones/${id}/leer`, { method: "POST" });
  };

  const marcarTodas = async () => {
    setItems((previo) =>
      previo.map((item) =>
        item.readAt ? item : { ...item, readAt: new Date().toISOString() }
      )
    );
    setSinLeer(0);

    await fetch("/api/notificaciones", { method: "POST" });
  };

  const formatearFecha = (iso: string) =>
    new Date(iso).toLocaleString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="relative" ref={contenedor}>
      <button
        type="button"
        onClick={() => {
          const siguiente = !abierto;
          setAbierto(siguiente);
          if (siguiente) cargar();
        }}
        className="relative rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />

        {sinLeer > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-black text-slate-950">
            {sinLeer > 9 ? "9+" : sinLeer}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <p className="text-sm font-bold text-white">Notificaciones</p>

            {sinLeer > 0 && (
              <button
                type="button"
                onClick={marcarTodas}
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 transition hover:text-amber-300"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {cargando && items.length === 0 ? (
              <div className="p-8 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-500" />
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                <Bell className="mx-auto mb-3 h-7 w-7 opacity-30" />
                No tienes notificaciones.
              </div>
            ) : (
              <ul className="divide-y divide-slate-800">
                {items.map((item) => {
                  const Icono = ICONOS[item.type] || Bell;
                  const noLeida = !item.readAt;

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => noLeida && marcarLeida(item.id)}
                        className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-850 ${
                          noLeida ? "bg-amber-500/5" : ""
                        }`}
                      >
                        <span
                          className={`mt-0.5 rounded-lg p-1.5 ${
                            noLeida
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-slate-800 text-slate-500"
                          }`}
                        >
                          <Icono className="h-4 w-4" />
                        </span>

                        <span className="min-w-0 flex-grow">
                          <span className="flex items-center gap-2">
                            <span
                              className={`text-sm font-semibold ${
                                noLeida ? "text-white" : "text-slate-400"
                              }`}
                            >
                              {item.title}
                            </span>
                            {noLeida && (
                              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                            )}
                          </span>

                          <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
                            {item.message}
                          </span>

                          <span className="mt-1 block text-[10px] uppercase tracking-wider text-slate-600">
                            {formatearFecha(item.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
