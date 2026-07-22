import { prisma } from "@/lib/db/prisma";

/**
 * Valor de la UIT de fábrica: S/ 5 500, vigente para 2026 según el
 * D.S. 301-2025-EF. Subió S/ 150 desde los S/ 5 350 de 2025.
 *
 * Cambia por decreto todos los años, y por eso el administrador puede
 * modificarlo desde `/admin` en vez de que haya que tocar el código cada enero.
 */
export const DEFAULT_UIT = 5500.0;

/**
 * Topes de lo que el administrador puede escribir.
 *
 * No pretenden ser exactos: solo atajan un tipeo. La UIT se mueve de a un par
 * de cientos por año, así que cualquier valor fuera de este rango es un error.
 */
export const MIN_UIT = 1000.0;
export const MAX_UIT = 20000.0;

/**
 * Escala de multas por gravedad, en porcentaje de la UIT.
 *
 * **Las multas municipales se expresan en porcentaje de UIT, no en UITs
 * enteras.** El cuadro de infracciones de Trujillo (Ordenanza Municipal
 * N.º 003-2008-MPT) maneja multas del **5 % al 200 % de la UIT**, así que estos
 * cuatro tramos caen dentro del rango real.
 *
 * **Los cortes exactos los fija el cuadro de infracciones de cada ordenanza** y
 * no se pudo leer el CISA completo de Trujillo: 20/50/100/200 es una escala
 * razonable, no una transcripción. Si aparece el cuadro real, se corrigen acá y
 * las dos pantallas se acomodan solas.
 */
export const GRAVEDADES = [
  { clave: "LEVE", nombre: "Leve", porcentaje: 20 },
  { clave: "GRAVE", nombre: "Grave", porcentaje: 50 },
  { clave: "MUY_GRAVE", nombre: "Muy grave", porcentaje: 100 },
  { clave: "MUY_GRAVE_AGRAVADA", nombre: "Muy grave agravada", porcentaje: 200 },
] as const;

export type GravedadMulta = (typeof GRAVEDADES)[number]["clave"];

export function esGravedadValida(valor: unknown): valor is GravedadMulta {
  return GRAVEDADES.some((g) => g.clave === valor);
}

/**
 * UIT vigente.
 *
 * Ante un problema de base devuelve la de fábrica antes que romper el registro
 * de una multa: mismo criterio que `getTupaAmount`.
 */
export async function getUit(): Promise<number> {
  try {
    const fila = await prisma.uit.findUnique({ where: { id: "singleton" } });

    return fila ? Number(fila.amount) : DEFAULT_UIT;
  } catch {
    return DEFAULT_UIT;
  }
}

/** Cambia el valor de la UIT. Devuelve el que quedó vigente. */
export async function setUit(amount: number): Promise<number> {
  if (!Number.isFinite(amount)) {
    throw new Error("El valor de la UIT no es un monto válido.");
  }

  const monto = Math.round(amount * 100) / 100;

  if (monto < MIN_UIT) {
    throw new Error(`La UIT no puede ser menor a S/ ${MIN_UIT.toFixed(2)}.`);
  }

  if (monto > MAX_UIT) {
    throw new Error(`La UIT no puede superar los S/ ${MAX_UIT.toFixed(2)}.`);
  }

  await prisma.uit.upsert({
    where: { id: "singleton" },
    update: { amount: monto },
    create: { id: "singleton", amount: monto },
  });

  return monto;
}

/**
 * Monto de la multa para una gravedad, con la UIT vigente.
 *
 * **El cálculo vive en el servidor y el cliente solo muestra el resultado.**
 * Si el navegador mandara el monto, un cambio de UIT entre que se abre la
 * pantalla y se registra la multa dejaría el importe viejo; mandando la
 * gravedad, el monto se calcula siempre contra el valor del momento.
 */
export async function montoDeMulta(gravedad: GravedadMulta): Promise<number> {
  const escala = GRAVEDADES.find((g) => g.clave === gravedad);

  if (!escala) {
    throw new Error("La gravedad de la multa no es válida.");
  }

  const uit = await getUit();

  return Math.round(uit * escala.porcentaje) / 100;
}
