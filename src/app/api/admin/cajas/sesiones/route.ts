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
    const [aperturas, cierres, abiertas, historial] = await Promise.all([
      CashSessionService.listPendingOpenings(),
      CashSessionService.listPendingCloses(),
      CashSessionService.listOpenSessions(),
      CashSessionService.listHistory(),
    ]);

    // Las abiertas llevan además su estado de caja: es contra eso que el
    // administrador decide cuánto entregar o retirar.
    const abiertasConTotales = await Promise.all(
      abiertas.map(async (sesion) => {
        const totales = await CashSessionService.getSessionTotals(sesion.id);

        return {
          id: sesion.id,
          cajero: sesion.cashier.fullName,
          email: sesion.cashier.email,
          openedAt: sesion.openedAt,
          fondo: totales.fondo,
          efectivo: totales.efectivo,
          digital: totales.digital,
          entregado: totales.entregado,
          retirado: totales.retirado,
          esperadoEnCaja: totales.esperadoEnCaja,
          movimientos: totales.movimientos.map((m) => ({
            id: m.id,
            tipo: m.type,
            monto: Number(m.amount),
            motivo: m.reason,
            fecha: m.createdAt,
            autor: m.createdBy.fullName,
          })),
        };
      })
    );

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
      aperturas: aperturas.map(serializar),
      cierres: cierres.map(serializar),
      abiertas: abiertasConTotales,
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

/** Acciones que puede tomar el administrador sobre una solicitud de caja. */
const ACCIONES = [
  "autorizar-apertura",
  "rechazar-apertura",
  "autorizar-cierre",
  "rechazar-cierre",
] as const;

type Accion = (typeof ACCIONES)[number];

function esAccion(valor: string): valor is Accion {
  return (ACCIONES as readonly string[]).includes(valor);
}

/** El administrador resuelve una solicitud de apertura o de cierre. */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const sessionId = String(body.sessionId || "").trim();
    const accion = String(body.accion || "").trim();
    const reason = body.reason === undefined ? undefined : String(body.reason);

    if (!sessionId) {
      return NextResponse.json(
        { error: "Falta el identificador del turno." },
        { status: 400 }
      );
    }

    if (!esAccion(accion)) {
      return NextResponse.json(
        { error: "La acción sobre el turno no es válida." },
        { status: 400 }
      );
    }

    const mensajes: Record<Accion, string> = {
      "autorizar-apertura": "Caja abierta. El cajero ya puede registrar cobros.",
      "rechazar-apertura":
        "Apertura rechazada. El cajero puede volver a solicitarla.",
      "autorizar-cierre": "Caja cerrada.",
      "rechazar-cierre":
        "Cierre rechazado. La caja vuelve a estar abierta para que el cajero cuente de nuevo.",
    };

    if (accion === "autorizar-apertura") {
      await CashSessionService.approveOpen({ adminId: user.id, sessionId });
    } else if (accion === "rechazar-apertura") {
      await CashSessionService.rejectOpen({ adminId: user.id, sessionId, reason });
    } else if (accion === "autorizar-cierre") {
      await CashSessionService.approveClose({ adminId: user.id, sessionId });
    } else {
      await CashSessionService.rejectClose({ adminId: user.id, sessionId, reason });
    }

    return NextResponse.json({ success: true, message: mensajes[accion] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo resolver la solicitud." },
      { status: 400 }
    );
  }
}
