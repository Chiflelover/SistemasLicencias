import { NextResponse } from "next/server";
import { RucService } from "@/services/ruc.service";
import { belongsToDistrictTrujillo } from "@/lib/territory";

export const dynamic = "force-dynamic";

/**
 * Establecimientos anexos del RUC en SUNAT.
 *
 * Va aparte de `/api/ruc/[ruc]` a propósito, por dos motivos:
 *
 *  - Consume una consulta distinta de la cuota de APIPERU. Juntarlos obligaría
 *    a gastar dos por cada validación de RUC, incluso donde la tarjeta no se
 *    muestra.
 *  - Es información decorativa. Separada, una falla acá no puede arrastrar a la
 *    validación del RUC, que sí decide si el trámite arranca.
 *
 * Abierta, con el mismo criterio que `/api/ruc/[ruc]`: son datos públicos de
 * una empresa, no de una persona.
 *
 * Nunca devuelve error: sin acceso o con la API caída responde lista vacía y la
 * pantalla no dibuja nada.
 */
export async function GET(
  request: Request,
  { params }: { params: { ruc: string } }
) {
  const ruc = params.ruc?.trim();

  if (!ruc || !/^\d{11}$/.test(ruc)) {
    return NextResponse.json(
      { error: "El RUC debe tener 11 dígitos." },
      { status: 400 }
    );
  }

  const establecimientos = await RucService.getEstablishments(ruc);

  // Cuántos caen bajo la jurisdicción de la MPT. Se calcula en el servidor
  // porque la regla de territorio vive acá y no debe reescribirse en el
  // navegador: cada local fuera del distrito necesita su licencia en SU
  // municipalidad, no en esta.
  const enTrujillo = establecimientos.filter((local) =>
    belongsToDistrictTrujillo(local)
  ).length;

  return NextResponse.json({
    establecimientos,
    total: establecimientos.length,
    enTrujillo,
    fueraDeTrujillo: establecimientos.length - enTrujillo,
  });
}
