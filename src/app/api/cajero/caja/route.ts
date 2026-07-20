import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  CashSessionService,
  DEFAULT_OPENING_AMOUNT,
} from "@/services/cash-session.service";

export const dynamic = "force-dynamic";

/** Estado de la caja del cajero autenticado. */
export async function GET() {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const abierta = await CashSessionService.getOpenSession(user.id);
    const pendiente = await CashSessionService.getPendingSession(user.id);

    const totales = abierta
      ? await CashSessionService.getSessionTotals(abierta.id)
      : null;

    return NextResponse.json({
      montoSugerido: DEFAULT_OPENING_AMOUNT,
      abierta: abierta
        ? {
            id: abierta.id,
            openedAt: abierta.openedAt,
            openingAmount: Number(abierta.openingAmount),
          }
        : null,
      pendiente: pendiente
        ? {
            id: pendiente.id,
            diferencia: Number(pendiente.difference ?? 0),
            justificacion: pendiente.justification,
          }
        : null,
      totales: totales
        ? {
            operaciones: totales.operaciones,
            fondo: totales.fondo,
            efectivo: totales.efectivo,
            digital: totales.digital,
            esperadoEnCaja: totales.esperadoEnCaja,
          }
        : null,
    });
  } catch (error: any) {
    console.error("Error consultando la caja:", error);

    return NextResponse.json(
      { error: error?.message || "Error interno al consultar la caja." },
      { status: 500 }
    );
  }
}

/** Apertura de caja. */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const openingAmount = Number(body.openingAmount);

    const session = await CashSessionService.openSession({
      cashierId: user.id,
      openingAmount,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Caja abierta.",
        session: {
          id: session.id,
          openedAt: session.openedAt,
          openingAmount: Number(session.openingAmount),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo abrir la caja." },
      { status: 400 }
    );
  }
}
