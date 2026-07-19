/**
 * Regla territorial del sistema: solo se atienden establecimientos del
 * distrito de Trujillo, provincia de Trujillo, departamento de La Libertad.
 */

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase();
}

export function belongsToDistrictTrujillo(data: {
  distrito?: string;
  provincia?: string;
  departamento?: string;
}) {
  return (
    normalizeText(data.distrito || "") === "TRUJILLO" &&
    normalizeText(data.provincia || "") === "TRUJILLO" &&
    normalizeText(data.departamento || "") === "LA LIBERTAD"
  );
}

/** Mensaje único de rechazo territorial, para no repetirlo en cada ruta. */
export const OUT_OF_DISTRICT_MESSAGE =
  "No se puede iniciar el trámite. Este sistema solo atiende establecimientos con domicilio fiscal en el distrito de Trujillo, provincia de Trujillo, departamento de La Libertad.";
