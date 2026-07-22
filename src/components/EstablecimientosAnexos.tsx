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
 * Con `onSeleccionar` los locales **del distrito de Trujillo** se vuelven
 * elegibles: el que se elija es el establecimiento para el que se emite la
 * licencia. Los de otro distrito no son clicables — esa licencia la emite otra
 * municipalidad, y es la misma regla que decide si el trámite arranca.
 *
 * Sin `onSeleccionar` la tarjeta es informativa, como nació. Si la consulta
 * falla no se dibuja nada y la pantalla queda como si no existiera.
 *
 * Se muestra porque la Ley 28976 pide una licencia **por establecimiento**, así
 * que ver los locales del RUC ayuda al ciudadano a darse cuenta de cuántos
 * trámites le van a hacer falta, y al cajero a preguntarlo en el mostrador.
 */
export default function EstablecimientosAnexos({
  ruc,
  seleccionado,
  seleccionadoCodigo,
  onSeleccionar,
}: {
  ruc: string | null;
  /** Dirección del local elegido. Vacío = el domicilio fiscal. */
  seleccionado?: string;
  /**
   * Código del local elegido. Es lo que marca cuál está seleccionado.
   *
   * No alcanza con la dirección: hay RUCs con **varios anexos en la misma
   * dirección exacta** —la UNT tiene tres— y marcando por dirección se
   * encendían todos juntos.
   */
  seleccionadoCodigo?: string;
  onSeleccionar?: (local: { codigo: string; direccion: string } | null) => void;
}) {
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

  // Código del local marcado. Si no vino —al retomar un trámite solo se guardó
  // la dirección— se toma el primero que coincida: entre locales de la misma
  // dirección da igual cuál se marque, la licencia imprime lo mismo.
  const codigoMarcado =
    seleccionadoCodigo ||
    (seleccionado
      ? data.establecimientos.find((l) => l.direccion === seleccionado)?.codigo
      : undefined);

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

              const elegible = Boolean(onSeleccionar) && enTrujillo && Boolean(local.direccion);
              const activo = elegible && codigoMarcado === local.codigo;

              const contenido = (
                <>
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
                </>
              );

              const base = "rounded-xl border p-3 transition";

              if (!elegible) {
                return (
                  <li
                    key={local.codigo || local.direccion}
                    className={`${base} border-slate-800 bg-slate-900/40`}
                  >
                    {contenido}
                  </li>
                );
              }

              return (
                <li key={local.codigo || local.direccion}>
                  <button
                    type="button"
                    // Volver a tocar el elegido deshace la elección y el trámite
                    // vuelve al domicilio fiscal, que es el valor por defecto.
                    onClick={() =>
                      onSeleccionar!(
                        activo
                          ? null
                          : { codigo: local.codigo, direccion: local.direccion }
                      )
                    }
                    className={`${base} w-full text-left ${
                      activo
                        ? "border-emerald-500/60 bg-emerald-500/10"
                        : "border-slate-800 bg-slate-900/40 hover:border-emerald-500/40"
                    }`}
                  >
                    {contenido}
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-slate-500">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Cada local necesita su propia licencia (Ley 28976).
          </p>
        </>
      )}
    </div>
  );
}
