"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, Store } from "lucide-react";

type Establecimiento = {
  codigo: string;
  tipo: string;
  actividad: string;
  direccion: string;
  distrito: string;
  provincia: string;
  departamento: string;
};

type Respuesta = {
  establecimientos: Establecimiento[];
  total: number;
  enTrujillo: number;
  fueraDeTrujillo: number;
};

/**
 * Locales que la empresa tiene declarados en SUNAT además del domicilio fiscal.
 *
 * **Es informativa y nada más.** No valida, no bloquea y no participa de
 * ninguna regla: el trámite se inicia por el domicilio fiscal, igual que
 * antes. Si la consulta falla, la tarjeta no se dibuja y la pantalla queda como
 * si no existiera.
 *
 * Se muestra porque la Ley 28976 pide una licencia **por establecimiento**, así
 * que ver los locales del RUC ayuda al ciudadano a darse cuenta de cuántos
 * trámites le van a hacer falta, y al cajero a preguntarlo en el mostrador.
 */
export default function EstablecimientosAnexos({ ruc }: { ruc: string | null }) {
  const [data, setData] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!ruc || !/^\d{11}$/.test(ruc)) {
      setData(null);
      return;
    }

    // `cancelado` evita que la respuesta de un RUC viejo pise a la del nuevo si
    // la persona corrige el número mientras la consulta está en vuelo.
    let cancelado = false;

    setCargando(true);

    fetch(`/api/ruc/${ruc}/anexos`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelado) setData(json?.establecimientos ? json : null);
      })
      .catch(() => {
        // Dato decorativo: si falla, no se dice nada y la tarjeta desaparece.
        if (!cancelado) setData(null);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [ruc]);

  if (!ruc) return null;

  if (cargando) {
    return (
      <div className="rounded-[2rem] border border-slate-800 bg-slate-950/70 p-5 flex items-center gap-3 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Consultando establecimientos en SUNAT…
      </div>
    );
  }

  // Sin datos no se dibuja nada: ni error ni tarjeta vacía. La pantalla queda
  // igual que antes de que esto existiera.
  if (!data) return null;

  return (
    <div className="rounded-[2rem] border border-slate-800 bg-slate-950/70 p-5">
      <div className="mb-3 flex items-center gap-3 text-amber-300">
        <Store className="h-5 w-5" />
        <h3 className="text-sm font-bold text-white">Establecimientos anexos</h3>
      </div>

      {data.total === 0 ? (
        <p className="text-sm leading-6 text-slate-400">
          Este RUC no tiene locales anexos registrados en SUNAT. Solo figura su
          domicilio fiscal.
        </p>
      ) : (
        <>
          <p className="text-sm leading-6 text-slate-400">
            SUNAT registra{" "}
            <span className="font-bold text-white">
              {data.total} {data.total === 1 ? "local" : "locales"}
            </span>{" "}
            además del domicilio fiscal.
            {data.fueraDeTrujillo > 0 && (
              <>
                {" "}
                <span className="text-amber-300">
                  {data.fueraDeTrujillo === 1
                    ? "Uno está fuera del distrito de Trujillo"
                    : `${data.fueraDeTrujillo} están fuera del distrito de Trujillo`}
                </span>
                , así que su licencia la emite otra municipalidad.
              </>
            )}
          </p>

          <ul className="mt-4 space-y-2.5">
            {data.establecimientos.map((local) => {
              const enTrujillo =
                local.distrito.toUpperCase() === "TRUJILLO" &&
                local.provincia.toUpperCase() === "TRUJILLO";

              return (
                <li
                  key={local.codigo || local.direccion}
                  className="rounded-xl border border-slate-800 bg-slate-900/40 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Sin `uppercase`: al lado va el distrito en mayúsculas y
                        los dos gritando se leen peor. */}
                    <p className="text-xs font-bold text-slate-200">
                      {local.tipo}
                    </p>

                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        enTrujillo
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      {local.distrito || "Sin distrito"}
                    </span>
                  </div>

                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {local.direccion || "Dirección no registrada"}
                  </p>

                  {/* SUNAT la devuelve vacía casi siempre: solo se dibuja la
                      línea cuando trae algo. */}
                  {local.actividad && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {local.actividad}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-slate-500">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Referencial. El trámite se inicia por el domicilio fiscal; cada local
            necesita su propia licencia (Ley 28976).
          </p>
        </>
      )}
    </div>
  );
}
