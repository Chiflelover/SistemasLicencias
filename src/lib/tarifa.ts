import { prisma } from "@/lib/db/prisma";

/** Tarifa TUPA de fábrica del derecho de trámite. */
export const DEFAULT_TUPA_AMOUNT = 180.0;

/**
 * Billete de mayor denominación en circulación en Perú.
 *
 * Acota cuánto puede entregar el contribuyente en un pago en efectivo: por
 * encima de esto no hay billete que lo justifique, y sirve para atajar un
 * tipeo de más.
 */
export const MAX_BILL = 200.0;

/**
 * Tope de la tarifa configurable.
 *
 * No puede pasar el billete de mayor denominación: el cobro en efectivo exige
 * `recibido >= tarifa` y `recibido <= MAX_BILL`, así que con una tarifa mayor
 * no existiría ningún monto válido y la ventanilla no podría cobrar en
 * efectivo. Para permitir tarifas más altas habría que aceptar varios billetes,
 * que es otra regla.
 */
export const MAX_TUPA_AMOUNT = MAX_BILL;

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
      `La tarifa no puede superar los S/ ${MAX_TUPA_AMOUNT.toFixed(2)}, que es ` +
        "el billete de mayor denominación: por encima de eso no se podría " +
        "cobrar en efectivo."
    );
  }

  await prisma.tarifa.upsert({
    where: { id: "singleton" },
    update: { amount: monto },
    create: { id: "singleton", amount: monto },
  });

  return monto;
}
