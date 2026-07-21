/**
 * Cuentas base del personal: se pueden editar y desactivar, pero no eliminar.
 *
 * Son las precreadas por el seed sobre las que se apoya el resto del sistema.
 * Sin ningún inspector, `InspectionService.scheduleInspection` no encuentra a
 * quién asignarle la visita y el pago falla; sin la Caja 1 se pierde la
 * ventanilla de referencia del arqueo. Borrarlas por accidente deja el sistema
 * inutilizable y no hay pantalla para recrearlas con el mismo correo.
 *
 * Vive en lib y no en el servicio porque la pantalla del administrador también
 * la necesita, y ese archivo importa Prisma.
 */
const CUENTAS_BASE = new Set(["inspector@muni.pe", "cajero@muni.pe"]);

/** True si la cuenta no admite eliminación. */
export function isProtectedStaff(email: string | null | undefined): boolean {
  if (!email) return false;

  return CUENTAS_BASE.has(email.trim().toLowerCase());
}

export const PROTECTED_STAFF_MESSAGE =
  "Esta es una cuenta base del sistema y no se puede eliminar. Puedes editar sus datos o desactivarla.";

/**
 * Inspector base: además de no borrarse, tampoco se desactiva.
 *
 * Desactivarlo tiene el mismo efecto que borrarlo: `UserRepository`
 * .findInspectors() solo devuelve cuentas activas, así que sin ninguna
 * `scheduleInspection` lanza y todo pago queda sin inspección agendada. Los
 * cajeros sí se pueden desactivar: la Caja 2 cubre la ventanilla y ningún
 * proceso automático depende de ellos.
 */
const INSPECTOR_BASE = "inspector@muni.pe";

/** True si la cuenta no admite que se la desactive. */
export function isProtectedFromDeactivation(
  email: string | null | undefined
): boolean {
  if (!email) return false;

  return email.trim().toLowerCase() === INSPECTOR_BASE;
}

export const PROTECTED_DEACTIVATION_MESSAGE =
  "No se puede desactivar al inspector base: sin ningún inspector activo el sistema no puede agendar inspecciones.";

/**
 * Siempre tiene que quedar al menos una caja activa: sin ninguna no se puede
 * cobrar en ventanilla. Cuál es la que queda no importa —puede ser la Caja 1,
 * la 2 o una nueva—, la regla se evalúa contra cuántas hay activas en ese
 * momento, así que sigue valiendo al agregar cajas.
 */
export const LAST_CASHIER_MESSAGE =
  "Tiene que quedar al menos una caja activa: sin ninguna no se puede registrar ningún cobro en ventanilla.";

/**
 * El personal se amplía solo con cajas.
 *
 * El sistema trabaja con un único inspector: su cuenta está protegida y la
 * agenda del día, el WhatsApp y el reparto de franjas se apoyan en eso. Sumar
 * inspectores repartiría las inspecciones entre cuentas sin agenda propia.
 */
export const ONLY_CASHIERS_MESSAGE =
  "Solo se pueden agregar cajas. El sistema trabaja con un único inspector, cuya cuenta ya existe.";

/**
 * Tope de cajas del sistema.
 *
 * Cuenta las cuentas de cajero existentes, activas o no: una caja desactivada
 * sigue ocupando su lugar y se puede reencender en cualquier momento, así que
 * si contara solo las activas el tope se saltearía apagando y creando.
 */
export const MAX_CASHIERS = 10;

export const MAX_CASHIERS_MESSAGE = `No se pueden agregar más de ${MAX_CASHIERS} cajas. Elimina una existente si necesitas crear otra.`;
