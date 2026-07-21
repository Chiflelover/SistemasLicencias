import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { CashSessionService } from "@/services/cash-session.service";
import { CashMovementType } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * El administrador entrega o retira efectivo de una caja abierta.
 *
 * Ruta propia y no una acción más de `/api/admin/cajas/sesiones`: esa resuelve
 * solicitudes del cajero y esta mueve dinero, que son dos cosas distintas.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const sessionId = String(body.sessionId || "").trim();
    const tipo = String(body.tipo || "").trim().toUpperCase();
    const amount = Number(body.amount);
    const reason = String(body.reason || "");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Falta el identificador del turno." },
        { status: 400 }
      );
    }

    if (tipo !== CashMovementType.DEPOSIT && tipo !== CashMovementType.WITHDRAWAL) {
      return NextResponse.json(
        { error: "El movimiento tiene que ser una entrega o un retiro." },
        { status: 400 }
      );
    }

    const movimiento = await CashSessionService.registerMovement({
      adminId: user.id,
      sessionId,
      type: tipo,
      amount,
      reason,
    });

    const monto = Number(movimiento.amount).toFixed(2);

    return NextResponse.json({
      success: true,
      message:
        tipo === CashMovementType.DEPOSIT
          ? `Se entregaron S/ ${monto} a la caja.`
          : `Se retiraron S/ ${monto} de la caja.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo registrar el movimiento." },
      { status: 400 }
    );
  }
}
