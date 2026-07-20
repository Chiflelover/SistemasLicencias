/**
 * Validación local del RUC peruano.
 *
 * Un RUC son 11 dígitos donde el último es un dígito de control calculado por
 * módulo 11. Verificarlo acá evita gastar una consulta de APIPERU en números
 * mal tipeados, y le devuelve el error al usuario al instante.
 */

const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Prefijos que SUNAT asigna según la naturaleza del contribuyente. */
export const PREFIJO_PERSONA_JURIDICA = "20";
export const PREFIJOS_PERSONA_NATURAL = ["10", "15", "17"];

/** Dígito de control que le corresponde a los primeros 10 dígitos. */
function digitoDeControl(ruc: string): number {
  const digitos = ruc.split("").map(Number);
  const suma = PESOS.reduce((acc, peso, i) => acc + peso * digitos[i], 0);
  const resto = suma % 11;
  const calculado = 11 - resto;

  if (calculado === 10) return 0;
  if (calculado === 11) return 1;
  return calculado;
}

/** True si el RUC tiene 11 dígitos y su dígito de control cierra. */
export function isValidRuc(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc)) {
    return false;
  }

  return digitoDeControl(ruc) === Number(ruc[10]);
}

/** True si el RUC corresponde a una persona jurídica (empresa). */
export function isPersonaJuridica(ruc: string): boolean {
  return ruc.startsWith(PREFIJO_PERSONA_JURIDICA);
}

/** True si el RUC corresponde a una persona natural. */
export function isPersonaNatural(ruc: string): boolean {
  return PREFIJOS_PERSONA_NATURAL.some((prefijo) => ruc.startsWith(prefijo));
}
