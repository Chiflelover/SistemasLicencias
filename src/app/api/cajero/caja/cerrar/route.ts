import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { CashSessionService } from "@/services/cash-session.service";

export const dynamic = "force-dynamic";

/**
 * Cierre de caja.
 *
 * Si el efectivo contado coincide con el del sistema, el cajero cierra solo.
 * Si no coincide, hace falta una justificación y el turno queda esperando la
 * autorización de un administrador.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const resultado = await CashSessionService.closeSession({
      cashierId: user.id,
      countedAmount: Number(body.countedAmount),
      justification: body.justification,
    });

    return NextResponse.json({
      success: true,
      cuadra: resultado.cuadra,
      diferencia: resultado.diferencia,
      message: resultado.cuadra
        ? "Caja cerrada. El efectivo contado coincide con el del sistema."
        : "Se envió la solicitud al administrador para que autorice el cierre.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo cerrar la caja." },
      { status: 400 }
    );
  }
}
