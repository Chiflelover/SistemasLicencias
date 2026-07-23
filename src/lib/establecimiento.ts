import { RucService } from "@/services/ruc.service";

/** Resultado de resolver el establecimiento para el que se pide la licencia. */
export type EstablecimientoResuelto = {
  /** Dirección que se imprime en la licencia. */
  direccion: string;
  /**
   * `true` si el local elegido es un anexo real del RUC **en el distrito de
   * Trujillo**. Es lo que habilita la jurisdicción cuando el domicilio fiscal
   * está fuera: la licencia de un local de Trujillo la emite la MPT aunque la
   * empresa tenga su sede en otro lado (Ley 28976, la licencia es por
   * establecimiento y la emite la municipalidad donde está el local).
   */
  esAnexoTrujillo: boolean;
};

/**
 * Resuelve la dirección del establecimiento para el que se pide la licencia.
 *
 * Por defecto es el domicilio fiscal, que es como funcionó siempre. Si el
 * ciudadano —o el cajero— eligió uno de los locales anexos, se comprueba **en
 * el servidor** que sea de verdad uno de ese RUC y que esté en el distrito de
 * Trujillo: la pantalla solo deja tocar los que corresponden, pero una petición
 * directa podría mandar cualquier dirección y esa termina impresa en la
 * licencia —y ahora, además, decide la jurisdicción—.
 *
 * Sale del caché de anexos, así que normalmente no gasta cuota de APIPERU.
 *
 * Ante cualquier duda devuelve el domicilio fiscal y `esAnexoTrujillo: false`
 * en vez de lanzar: elegir el local es una comodidad y no puede frenar un alta.
 * Lo único que no hace nunca es dar por bueno un local que no pudo verificar.
 */
export async function resolverEstablecimiento(params: {
  ruc: string;
  fiscalAddress: string;
  elegido?: string | null;
}): Promise<EstablecimientoResuelto> {
  const elegido = String(params.elegido || "").trim();

  if (!elegido || elegido === params.fiscalAddress.trim()) {
    return { direccion: params.fiscalAddress, esAnexoTrujillo: false };
  }

  try {
    const anexos = await RucService.getEstablishments(params.ruc);

    const local = anexos.find(
      (anexo) => (anexo.direccion || "").trim() === elegido
    );

    if (!local) {
      return { direccion: params.fiscalAddress, esAnexoTrujillo: false };
    }

    // Mismo criterio que la tarjeta de anexos para marcar un local como
    // clicable: distrito y provincia Trujillo. Así "clicable en la pantalla"
    // y "aceptado por el servidor" son siempre lo mismo.
    const enTrujillo =
      (local.distrito || "").trim().toUpperCase() === "TRUJILLO" &&
      (local.provincia || "").trim().toUpperCase() === "TRUJILLO";

    return enTrujillo
      ? { direccion: local.direccion, esAnexoTrujillo: true }
      : { direccion: params.fiscalAddress, esAnexoTrujillo: false };
  } catch {
    return { direccion: params.fiscalAddress, esAnexoTrujillo: false };
  }
}
