import { prisma } from "./db/prisma";

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
 * En producción, usa siempre la fecha real actual.
 * En desarrollo/local, permite usar la fecha simulada del DevPanel.
 */
export async function getCurrentSystemDate(): Promise<Date> {
  if (process.env.NODE_ENV === "production") {
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
  const current =
    process.env.NODE_ENV === "production"
      ? new Date()
      : await getCurrentSystemDate();

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
  const current =
    process.env.NODE_ENV === "production"
      ? new Date()
      : await getCurrentSystemDate();

  const newDate = addYears(current, years);

  await prisma.systemConfig.upsert({
    where: { id: "singleton" },
    update: { simulatedDate: newDate },
    create: { id: "singleton", simulatedDate: newDate },
  });

  return newDate;
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