import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { CashSessionService } from "@/services/cash-session.service";

export const dynamic = "force-dynamic";

/**
 * Solicitud de cierre de caja.
 *
 * El cierre siempre queda esperando al administrador, cuadre o no. Si no
 * cuadra, además hace falta una justificación.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const resultado = await CashSessionService.requestClose({
      cashierId: user.id,
      countedAmount: Number(body.countedAmount),
      justification: body.justification,
    });

    return NextResponse.json({
      success: true,
      cuadra: resultado.cuadra,
      diferencia: resultado.diferencia,
      message: resultado.cuadra
        ? "El efectivo contado coincide con el del sistema. Se envió la solicitud al administrador para que autorice el cierre."
        : "Se envió la solicitud al administrador con el motivo del descuadre.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo solicitar el cierre." },
      { status: 400 }
    );
  }
}
