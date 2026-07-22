"use client";

import { useEffect, useRef } from "react";

/**
 * Sin interacción por este lapso se deja de preguntar.
 *
 * Es el mismo corte que usa `KeepAlive` y por el mismo motivo: la pestaña
 * olvidada en un segundo monitor consumiría sola las 100 CU-horas del mes de
 * Neon. El sondeo hereda el criterio en vez de inventar otro.
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
 * Vuelve a llamar a `alSondear` cada `intervaloMs` mientras haga falta.
 *
 * Existe porque una página no recibe nada sola: el navegador tiene que
 * preguntar. Es lo que hace que al administrador le aparezca la solicitud del
 * cajero sin apretar F5, y que al cajero se le cierre el modal cuando se la
 * autorizan.
 *
 * Tres frenos, y los tres importan:
 *
 *  - `activo` en false no instala ningún temporizador. Con eso el sondeo del
 *    cajero **se apaga solo** en cuanto le autorizan la caja: mientras trabaja
 *    no queda nada corriendo.
 *  - Con la ventana fuera de la vista no pregunta, y al volver pregunta en el
 *    acto: así el aviso aparece apenas se mira la pantalla.
 *  - A los 45 minutos sin tocar nada se calla.
 */
export function useSondeo(
  alSondear: () => void,
  intervaloMs: number,
  activo = true
) {
  // La referencia evita reinstalar el temporizador en cada render: el callback
  // suele ser una función nueva cada vez y el intervalo se reiniciaría solo.
  const callback = useRef(alSondear);
  callback.current = alSondear;

  // Hora real del navegador, no la simulada del DevPanel: se mide inactividad
  // de la persona, no el reloj del trámite.
  const ultimaInteraccion = useRef(Date.now());

  useEffect(() => {
    if (!activo) return;

    const marcarInteraccion = () => {
      ultimaInteraccion.current = Date.now();
    };

    const sondear = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultimaInteraccion.current > INACTIVIDAD_MS) return;

      callback.current();
    };

    const alCambiarVisibilidad = () => {
      if (document.visibilityState !== "visible") return;

      // Volver a la ventana cuenta como interacción y es justo el momento en
      // que puede haber algo esperando: se pregunta ya, no en el siguiente tic.
      marcarInteraccion();
      sondear();
    };

    for (const evento of EVENTOS_DE_INTERACCION) {
      window.addEventListener(evento, marcarInteraccion, { passive: true });
    }

    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    const intervalo = window.setInterval(sondear, intervaloMs);

    return () => {
      window.clearInterval(intervalo);

      for (const evento of EVENTOS_DE_INTERACCION) {
        window.removeEventListener(evento, marcarInteraccion);
      }

      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [activo, intervaloMs]);
}

/** Cada cuánto pregunta la ventanilla y el panel del administrador. */
export const INTERVALO_SONDEO_MS = 20 * 1000;
