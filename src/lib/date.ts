import { prisma } from "./db/prisma";

/**
 * Obtiene la fecha actual del sistema (simulada o real).
 * En entornos de demostración académica, la fecha puede avanzarse
 * mediante el DevPanel para simular vencimientos y renovaciones.
 */
export async function getCurrentSystemDate(): Promise<Date> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { id: "singleton" },
    });
    if (config?.simulatedDate) {
      return new Date(config.simulatedDate);
    }
  } catch {
    // Si no hay BD, usar fecha real
  }
  return new Date();
}

/**
 * Avanza la fecha simulada del sistema en N días.
 */
export async function advanceSystemDate(days: number): Promise<Date> {
  const current = await getCurrentSystemDate();
  const newDate = new Date(current);
  newDate.setDate(newDate.getDate() + days);
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
 * Retorna true si la fecha dada es un día hábil (lunes a viernes).
 */
export function isWorkDay(date: Date): boolean {
  const day = date.getDay(); // 0=Dom, 6=Sab
  return day !== 0 && day !== 6;
}

/**
 * Avanza la fecha N días hábiles a partir de la fecha base dada.
 */
export function addWorkDays(base: Date, workDays: number): Date {
  const result = new Date(base);
  let added = 0;
  while (added < workDays) {
    result.setDate(result.getDate() + 1);
    if (isWorkDay(result)) added++;
  }
  return result;
}
