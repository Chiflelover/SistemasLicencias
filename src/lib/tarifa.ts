import { prisma } from "@/lib/db/prisma";

/** Tarifa TUPA de fábrica del derecho de trámite. */
export const DEFAULT_TUPA_AMOUNT = 180.0;

/**
 * Tope de la tarifa configurable.
 *
 * Estuvo atado al billete de mayor denominación (S/ 200) mientras el cobro en
 * efectivo exigía que lo recibido no pasara de un billete: con una tarifa
 * mayor no existía ningún monto válido. Al aceptar varios billetes esa atadura
 * desapareció y el tope pasó a ser solo un número redondo que ataja un tipeo.
 */
export const MAX_TUPA_AMOUNT = 1000.0;

/** Mínimo de la tarifa: cobrar cero no es cobrar. */
export const MIN_TUPA_AMOUNT = 1.0;

/**
 * Tarifa vigente.
 *
 * Se lee en cada cobro y no se congela al iniciar el trámite: se paga lo que
 * rige el día que se paga. Lo cobrado de verdad queda en `Payment.amount`, así
 * que cambiar la tarifa no altera ningún comprobante ya emitido.
 */
export async function getTupaAmount(): Promise<number> {
  try {
    const tarifa = await prisma.tarifa.findUnique({
      where: { id: "singleton" },
    });

    return tarifa ? Number(tarifa.amount) : DEFAULT_TUPA_AMOUNT;
  } catch {
    // Ante un problema de base se cobra la tarifa de fábrica antes que romper
    // el cobro: es el mismo criterio que el resto de las operaciones
    // auxiliares.
    return DEFAULT_TUPA_AMOUNT;
  }
}

/** Cambia la tarifa. Devuelve el valor que quedó vigente. */
export async function setTupaAmount(amount: number): Promise<number> {
  if (!Number.isFinite(amount)) {
    throw new Error("La tarifa no es un monto válido.");
  }

  // Se redondea a céntimos: una tarifa con más decimales daría vueltos
  // imposibles de entregar.
  const monto = Math.round(amount * 100) / 100;

  if (monto < MIN_TUPA_AMOUNT) {
    throw new Error(
      `La tarifa no puede ser menor a S/ ${MIN_TUPA_AMOUNT.toFixed(2)}.`
    );
  }

  if (monto > MAX_TUPA_AMOUNT) {
    throw new Error(
      `La tarifa no puede superar los S/ ${MAX_TUPA_AMOUNT.toFixed(2)}.`
    );
  }

  await prisma.tarifa.upsert({
    where: { id: "singleton" },
    update: { amount: monto },
    create: { id: "singleton", amount: monto },
  });

  return monto;
}
