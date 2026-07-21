import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DniService } from "@/services/dni.service";

export const dynamic = "force-dynamic";

/**
 * Consulta de DNI en RENIEC.
 *
 * Exige sesión del personal: devuelve el nombre de una persona a partir de su
 * documento, así que no corresponde dejarlo abierto como la consulta de RUC,
 * que es información pública de empresas. Solo lo usa el registro presencial
 * para completar al representante legal.
 */
export async function GET(
  _request: Request,
  { params }: { params: { dni: string } }
) {
  const user = await getCurrentUser();

  // Se comprueba el rol y no solo que haya sesión: el administrado no tiene
  // cuenta, así que cualquier sesión que llegue acá es de personal.
  const PERSONAL = ["CAJERO", "INSPECTOR", "ADMIN", "DEVELOPER"];

  if (!user || !PERSONAL.includes(user.role)) {
    return NextResponse.json(
      { error: "No autorizado. Inicia sesión para consultar un DNI." },
      { status: 401 }
    );
  }

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
