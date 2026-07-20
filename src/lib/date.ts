import { prisma } from "./db/prisma";
import { isTimeSimulatorEnabled } from "./simulator";

// Vercel ejecuta las funciones en UTC e ignora la variable de entorno TZ, así
// que setHours(8) guardaba las 08:00 UTC: las 03:00 de la madrugada en Perú.
// Todo el cálculo de fechas del sistema (franjas de inspección, límites del
// día en la agenda, días hábiles, bordes del arqueo) usa métodos de hora
// local, de modo que fijar la zona del proceso los corrige de una sola vez.
// Perú no tiene horario de verano: es UTC-5 fijo, sin transiciones.
//
// Se hace acá porque este módulo está en la cadena de importación de todo lo
// que opera con fechas, y así queda fijada antes de la primera cuenta.
process.env.TZ = "America/Lima";

export function cloneDate(date: Date): Date {
  return new Date(date.getTime());
}

export function addDaysToDate(date: Date, days: number): Date {
  const result = cloneDate(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addYears(date: Date, years: number): Date {
  const result = cloneDate(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

/**
 * Obtiene la fecha actual del sistema.
 *
 * Con el simulador apagado devuelve siempre la fecha real. Con el simulador
 * encendido usa la fecha del DevPanel, que es lo que permite demostrar
 * vencimientos y renovaciones sin esperar.
 */
export async function getCurrentSystemDate(): Promise<Date> {
  if (!isTimeSimulatorEnabled()) {
    return new Date();
  }

  try {
    const config = await prisma.systemConfig.findUnique({
      where: { id: "singleton" },
    });

    if (config?.simulatedDate) {
      return new Date(config.simulatedDate);
    }
  } catch {
    // Si no hay BD o falla Prisma, usar fecha real.
  }

  return new Date();
}

/**
 * Avanza la fecha simulada del sistema en N días.
 * Solo debe afectar al entorno local/desarrollo.
 */
export async function advanceSystemDateByDays(days: number): Promise<Date> {
  const current = await getCurrentSystemDate();

  const newDate = addDaysToDate(current, days);

  await prisma.systemConfig.upsert({
    where: { id: "singleton" },
    update: { simulatedDate: newDate },
    create: { id: "singleton", simulatedDate: newDate },
  });

  return newDate;
}

/**
 * Avanza la fecha simulada del sistema en N años.
 * Solo debe afectar al entorno local/desarrollo.
 */
export async function advanceSystemDateByYears(years: number): Promise<Date> {
  const current = await getCurrentSystemDate();

  const newDate = addYears(current, years);

  await prisma.systemConfig.upsert({
    where: { id: "singleton" },
    update: { simulatedDate: newDate },
    create: { id: "singleton", simulatedDate: newDate },
  });

  return newDate;
}

/**
 * Devuelve el reloj del sistema a la fecha real.
 *
 * Se usa para cerrar una demostración: al volver al presente, los estados que
 * dependen de la fecha (vencimientos, agenda del día) se recalculan solos.
 */
export async function resetSystemDate(): Promise<Date> {
  const now = new Date();

  await prisma.systemConfig.upsert({
    where: { id: "singleton" },
    update: { simulatedDate: now },
    create: { id: "singleton", simulatedDate: now },
  });

  return now;
}

/**
 * Calcula si dos fechas caen en el mismo día.
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Retorna true si la fecha dada es un día hábil.
 */
export function isWorkDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

/**
 * Avanza la fecha N días hábiles a partir de la fecha base dada.
 */
export function addWorkDays(base: Date, workDays: number): Date {
  const result = cloneDate(base);
  let added = 0;

  while (added < workDays) {
    result.setDate(result.getDate() + 1);

    if (isWorkDay(result)) {
      added++;
    }
  }

  return result;
}