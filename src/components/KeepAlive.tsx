"use client";

import { useEffect, useRef } from "react";

/** Neon suspende a los 5 minutos: el latido tiene que caer cómodo por debajo. */
const INTERVALO_MS = 4 * 60 * 1000;

/**
 * Sin interacción por este lapso se deja dormir la base.
 *
 * Es la protección contra la pestaña abierta en un segundo monitor: sin corte,
 * una sola pantalla encendida de noche consume las 100 CU-horas del mes y deja
 * el proyecto suspendido hasta el mes siguiente.
 */
const INACTIVIDAD_MS = 45 * 60 * 1000;

const EVENTOS_DE_INTERACCION = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart",
];

/**
 * Mantiene despierto el cómputo de Neon mientras alguien esté usando el
 * sistema, para evitar el error de conexión cerrada en la primera operación
 * después de una pausa.
 *
 * Va en el layout raíz, así que cubre también las pantallas públicas.
 */
export default function KeepAlive() {
  // Hora real del navegador, no la simulada del DevPanel: lo que se mide acá
  // es inactividad de la persona, no el reloj del trámite.
  const ultimaInteraccion = useRef(Date.now());

  useEffect(() => {
    const marcarInteraccion = () => {
      ultimaInteraccion.current = Date.now();
    };

    const latir = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultimaInteraccion.current > INACTIVIDAD_MS) return;

      // no-store: una respuesta cacheada no llega a la base y no despertaría
      // nada, que es justo lo contrario de lo que busca el latido.
      fetch("/api/system/keepalive", { cache: "no-store" }).catch(() => {
        // Mantener la base despierta es auxiliar: nunca debe romper la página.
      });
    };

    const alCambiarVisibilidad = () => {
      if (document.visibilityState !== "visible") return;

      // Volver a la pestaña cuenta como interacción, y es el momento en que la
      // base pudo haberse dormido: conviene despertarla antes de que la persona
      // opere, no en el siguiente tic.
      marcarInteraccion();
      latir();
    };

    for (const evento of EVENTOS_DE_INTERACCION) {
      window.addEventListener(evento, marcarInteraccion, { passive: true });
    }

    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    const intervalo = window.setInterval(latir, INTERVALO_MS);

    return () => {
      window.clearInterval(intervalo);

      for (const evento of EVENTOS_DE_INTERACCION) {
        window.removeEventListener(evento, marcarInteraccion);
      }

      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, []);

  return null;
}
