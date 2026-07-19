/**
 * Interruptor del simulador de tiempo.
 *
 * Es una herramienta de demostración: permite adelantar el reloj para mostrar
 * vencimientos, renovaciones y la agenda del inspector sin esperar semanas.
 *
 * Se controla con una variable de entorno explícita en lugar de NODE_ENV, para
 * poder habilitarlo en un despliegue de demostración (Vercel) sin que quede
 * activo por defecto en cualquier instalación.
 *
 * Con el interruptor apagado:
 *   - la fecha del sistema es siempre la real,
 *   - los endpoints del simulador responden 403,
 *   - el registro de cambios ni siquiera se ejecuta.
 */
export function isTimeSimulatorEnabled(): boolean {
  return process.env.ENABLE_TIME_SIMULATOR === "true";
}
