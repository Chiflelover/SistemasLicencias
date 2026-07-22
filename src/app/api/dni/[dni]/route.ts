import { NextResponse } from "next/server";
import { DniService } from "@/services/dni.service";

export const dynamic = "force-dynamic";

/**
 * Consulta de DNI contra el padrón reducido de SUNAT (no RENIEC: ver
 * `DniService`). Devuelve solo el nombre.
 *
 * **Sin sesión.** Antes exigía personal, porque devuelve el nombre de una
 * persona a partir de su documento y eso no es información pública como los
 * datos de una empresa. Se abrió para que el ciudadano pueda validar al
 * representante legal desde el formulario público, igual que valida el RUC: sin
 * esto, la licencia de un trámite web salía con el número de DNI y sin nombre.
 *
 * El costo es real y conviene tenerlo presente: cualquiera puede averiguar el
 * nombre detrás de un DNI. Se aceptó para la demostración académica, con el
 * mismo criterio con el que `/api/ruc/[ruc]` ya está abierto. Ver *Pendientes*
 * en CLAUDE.md.
 */
export async function GET(
  _request: Request,
  { params }: { params: { dni: string } }
) {
  try {
    const dni = params.dni?.trim();

    if (!dni || !/^\d{8}$/.test(dni)) {
      return NextResponse.json(
        { error: "El DNI debe tener 8 dígitos." },
        { status: 400 }
      );
    }

    const data = await DniService.getPersonData(dni);

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo consultar el DNI." },
      { status: 400 }
    );
  }
}
