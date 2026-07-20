import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { CashSessionService } from "@/services/cash-session.service";

export const dynamic = "force-dynamic";

/** Turnos de caja: los que esperan autorización y el historial reciente. */
export async function GET() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const [pendientes, historial] = await Promise.all([
      CashSessionService.listPendingApprovals(),
      CashSessionService.listHistory(),
    ]);

    const serializar = (sesion: any) => ({
      id: sesion.id,
      cajero: sesion.cashier.fullName,
      email: sesion.cashier.email,
      openedAt: sesion.openedAt,
      closedAt: sesion.closedAt,
      status: sesion.status,
      fondo: Number(sesion.openingAmount),
      efectivo: sesion.cashCollected === null ? null : Number(sesion.cashCollected),
      digital: sesion.digitalCollected === null ? null : Number(sesion.digitalCollected),
      esperado: sesion.expectedAmount === null ? null : Number(sesion.expectedAmount),
      contado: sesion.countedAmount === null ? null : Number(sesion.countedAmount),
      diferencia: sesion.difference === null ? null : Number(sesion.difference),
      justificacion: sesion.justification,
      autorizadoPor: sesion.closedBy?.fullName ?? null,
    });

    return NextResponse.json({
      pendientes: pendientes.map(serializar),
      historial: historial.map(serializar),
    });
  } catch (error: any) {
    console.error("Error listando turnos de caja:", error);

    return NextResponse.json(
      { error: error?.message || "Error interno al listar los turnos." },
      { status: 500 }
    );
  }
}

/** El administrador autoriza el cierre de una caja descuadrada. */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();

    await CashSessionService.approveClose({
      adminId: user.id,
      sessionId: String(body.sessionId || ""),
    });

    return NextResponse.json({
      success: true,
      message: "Caja cerrada.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo cerrar la caja." },
      { status: 400 }
    );
  }
}
