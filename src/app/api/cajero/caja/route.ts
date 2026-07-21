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
    // Los cuatro estados posibles son excluyentes, pero se consultan juntos:
    // son cuatro lecturas cortas contra el mismo índice y evitan encadenar
    // idas y vueltas a Neon, que es lo que se paga caro acá.
    const [abierta, apertura, pendienteCierre, rechazo] = await Promise.all([
      CashSessionService.getOpenSession(user.id),
      CashSessionService.getPendingOpenSession(user.id),
      CashSessionService.getPendingCloseSession(user.id),
      CashSessionService.getLastRejectedOpening(user.id),
    ]);

    const totales = abierta
      ? await CashSessionService.getSessionTotals(abierta.id)
      : null;

    return NextResponse.json({
      montoSugerido: DEFAULT_OPENING_AMOUNT,
      apertura: apertura
        ? {
            id: apertura.id,
            solicitadaEn: apertura.openedAt,
            openingAmount: Number(apertura.openingAmount),
          }
        : null,
      abierta: abierta
        ? {
            id: abierta.id,
            openedAt: abierta.openedAt,
            openingAmount: Number(abierta.openingAmount),
            // Una caja abierta con justificación es una a la que le rechazaron
            // el cierre: el motivo lo dejó el administrador.
            cierreRechazado: abierta.justification,
          }
        : null,
      pendienteCierre: pendienteCierre
        ? {
            id: pendienteCierre.id,
            diferencia: Number(pendienteCierre.difference ?? 0),
            justificacion: pendienteCierre.justification,
          }
        : null,
      aperturaRechazada: rechazo ? { motivo: rechazo.justification } : null,
      totales: totales
        ? {
            operaciones: totales.operaciones,
            fondo: totales.fondo,
            efectivo: totales.efectivo,
            digital: totales.digital,
            entregado: totales.entregado,
            retirado: totales.retirado,
            esperadoEnCaja: totales.esperadoEnCaja,
            // El cajero cuenta el cajón contra este número: sin ver qué
            // entregó o retiró el administrador, le daría distinto y no sabría
            // por qué.
            movimientos: totales.movimientos.map((m) => ({
              id: m.id,
              tipo: m.type,
              monto: Number(m.amount),
              motivo: m.reason,
              fecha: m.createdAt,
              autor: m.createdBy.fullName,
            })),
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

/** Solicitud de apertura de caja. La autoriza un administrador. */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const openingAmount = Number(body.openingAmount);

    const session = await CashSessionService.requestOpen({
      cashierId: user.id,
      openingAmount,
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "Solicitud enviada. La caja queda habilitada cuando el administrador autorice la apertura.",
        session: {
          id: session.id,
          solicitadaEn: session.openedAt,
          openingAmount: Number(session.openingAmount),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo solicitar la apertura." },
      { status: 400 }
    );
  }
}
