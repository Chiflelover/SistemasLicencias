import { RucService } from "@/services/ruc.service";

/**
 * Resuelve la dirección del establecimiento para el que se pide la licencia.
 *
 * Por defecto es el domicilio fiscal, que es como funcionó siempre. Si el
 * ciudadano —o el cajero— eligió uno de los locales anexos, se comprueba **en
 * el servidor** que sea de verdad uno de ese RUC y que esté en el distrito de
 * Trujillo: la pantalla solo deja tocar los que corresponden, pero una petición
 * directa podría mandar cualquier dirección y esa termina impresa en la
 * licencia.
 *
 * Sale del caché de anexos, así que normalmente no gasta cuota de APIPERU.
 *
 * Ante cualquier duda devuelve el domicilio fiscal en vez de lanzar: la
 * elección del local es una comodidad y no puede frenar un alta. Lo único que
 * no hace nunca es aceptar una dirección que no pudo verificar.
 */
export async function resolverEstablecimiento(params: {
  ruc: string;
  fiscalAddress: string;
  elegido?: string | null;
}): Promise<string> {
  const elegido = String(params.elegido || "").trim();

  if (!elegido || elegido === params.fiscalAddress.trim()) {
    return params.fiscalAddress;
  }

  try {
    const anexos = await RucService.getEstablishments(params.ruc);

    const local = anexos.find(
      (anexo) => (anexo.direccion || "").trim() === elegido
    );

    if (!local) {
      return params.fiscalAddress;
    }

    const enTrujillo =
      (local.distrito || "").trim().toUpperCase() === "TRUJILLO" &&
      (local.provincia || "").trim().toUpperCase() === "TRUJILLO";

    return enTrujillo ? local.direccion : params.fiscalAddress;
  } catch {
    return params.fiscalAddress;
  }
}
