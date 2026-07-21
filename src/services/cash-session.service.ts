import { prisma } from "@/lib/db/prisma";
import { getCurrentSystemDate } from "@/lib/date";
import { AuditService } from "@/services/audit.service";
import { CashSessionStatus, PaymentMethod } from "@prisma/client";

/** Fondo con el que se sugiere abrir la caja. */
export const DEFAULT_OPENING_AMOUNT = 500.0;

/** Hora a partir de la cual corresponde cerrar la caja. Solo informativo. */
export const CLOSING_HOUR = 20;

/**
 * Turnos de caja.
 *
 * Sin turno abierto no se puede registrar un cobro. Al cerrar, el cajero
 * cuenta el efectivo del cajón: si coincide con lo que dice el sistema cierra
 * él mismo, y si no, queda a la espera de que un administrador lo autorice
 * con la justificación del faltante o sobrante.
 *
 * Lo digital (tarjeta, Yape, Plin) se recauda igual pero no pasa por el
 * cajón, así que se informa aparte y no entra en el conteo.
 */
export class CashSessionService {
  static async getOpenSession(cashierId: string) {
    return prisma.cashSession.findFirst({
      where: { cashierId, status: CashSessionStatus.OPEN },
      orderBy: { openedAt: "desc" },
    });
  }

  /** Turno esperando que un administrador autorice el cierre descuadrado. */
  static async getPendingSession(cashierId: string) {
    return prisma.cashSession.findFirst({
      where: { cashierId, status: CashSessionStatus.PENDING_APPROVAL },
      orderBy: { openedAt: "desc" },
    });
  }

  static async openSession(params: {
    cashierId: string;
    openingAmount: number;
  }) {
    const abierta = await this.getOpenSession(params.cashierId);

    if (abierta) {
      throw new Error("Ya tienes una caja abierta. Ciérrala antes de abrir otra.");
    }

    const pendiente = await this.getPendingSession(params.cashierId);

    if (pendiente) {
      throw new Error(
        "Tu último cierre quedó esperando la autorización del administrador. No puedes abrir una caja nueva hasta que lo resuelva."
      );
    }

    if (!Number.isFinite(params.openingAmount) || params.openingAmount < 0) {
      throw new Error("El monto de apertura no es válido.");
    }

    const openedAt = await getCurrentSystemDate();

    const session = await prisma.cashSession.create({
      data: {
        cashierId: params.cashierId,
        openingAmount: params.openingAmount,
        openedAt,
      },
    });

    await AuditService.log({
      action: "CAJA_ABIERTA",
      entityType: "CashSession",
      entityId: session.id,
      userId: params.cashierId,
      details: {
        openingAmount: params.openingAmount,
        openedAt: openedAt.toISOString(),
      },
    });

    return session;
  }

  /**
   * Recaudación del turno, separada por dónde termina el dinero: el efectivo
   * en el cajón y lo digital en la cuenta municipal.
   */
  static async getSessionTotals(sessionId: string) {
    const session = await prisma.cashSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error("No se encontró el turno de caja.");
    }

    const hasta = session.closedAt ?? (await getCurrentSystemDate());

    const pagos = await prisma.payment.findMany({
      where: {
        registeredById: session.cashierId,
        paidAt: { gte: session.openedAt, lte: hasta },
      },
      select: { amount: true, method: true },
    });

    let efectivo = 0;
    let digital = 0;

    for (const pago of pagos) {
      const monto = Number(pago.amount);

      if (pago.method === PaymentMethod.EFECTIVO) {
        efectivo += monto;
      } else {
        digital += monto;
      }
    }

    const fondo = Number(session.openingAmount);

    return {
      session,
      operaciones: pagos.length,
      fondo,
      efectivo,
      digital,
      // Solo el efectivo se cuenta a mano: lo digital nunca pasó por el cajón.
      esperadoEnCaja: fondo + efectivo,
    };
  }

  /**
   * Cierre del cajero. Si el conteo coincide con lo esperado, cierra. Si no,
   * exige justificación y deja el turno esperando al administrador.
   */
  static async closeSession(params: {
    cashierId: string;
    countedAmount: number;
    justification?: string;
  }) {
    const session = await this.getOpenSession(params.cashierId);

    if (!session) {
      throw new Error("No tienes ninguna caja abierta.");
    }

    if (!Number.isFinite(params.countedAmount) || params.countedAmount < 0) {
      throw new Error("El monto contado no es válido.");
    }

    const totales = await this.getSessionTotals(session.id);
    const diferencia = params.countedAmount - totales.esperadoEnCaja;

    // Se compara en céntimos para no arrastrar el error de coma flotante.
    const cuadra = Math.round(diferencia * 100) === 0;
    const justificacion = (params.justification ?? "").trim();

    if (!cuadra && justificacion.length < 10) {
      throw new Error(
        "El efectivo contado no coincide con el del sistema. Explicá el motivo del faltante o sobrante para pedir la autorización del administrador."
      );
    }

    const ahora = await getCurrentSystemDate();

    const actualizada = await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        cashCollected: totales.efectivo,
        digitalCollected: totales.digital,
        expectedAmount: totales.esperadoEnCaja,
        countedAmount: params.countedAmount,
        difference: diferencia,
        justification: cuadra ? null : justificacion,
        status: cuadra
          ? CashSessionStatus.CLOSED
          : CashSessionStatus.PENDING_APPROVAL,
        closedAt: cuadra ? ahora : null,
      },
    });

    await AuditService.log({
      action: cuadra ? "CAJA_CERRADA" : "CAJA_CIERRE_SOLICITADO",
      entityType: "CashSession",
      entityId: session.id,
      userId: params.cashierId,
      details: {
        esperado: totales.esperadoEnCaja,
        contado: params.countedAmount,
        diferencia,
        efectivo: totales.efectivo,
        digital: totales.digital,
      },
    });

    return { session: actualizada, cuadra, diferencia, totales };
  }

  /** Turnos descuadrados esperando resolución del administrador. */
  static async listPendingApprovals() {
    return prisma.cashSession.findMany({
      where: { status: CashSessionStatus.PENDING_APPROVAL },
      include: { cashier: { select: { fullName: true, email: true } } },
      orderBy: { openedAt: "asc" },
    });
  }

  /** El administrador autoriza el cierre de una caja descuadrada. */
  static async approveClose(params: { adminId: string; sessionId: string }) {
    const session = await prisma.cashSession.findUnique({
      where: { id: params.sessionId },
    });

    if (!session) {
      throw new Error("No se encontró el turno de caja.");
    }

    if (session.status !== CashSessionStatus.PENDING_APPROVAL) {
      throw new Error("Ese turno no está esperando autorización.");
    }

    const ahora = await getCurrentSystemDate();

    const cerrada = await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: CashSessionStatus.CLOSED,
        closedAt: ahora,
        closedById: params.adminId,
      },
    });

    await AuditService.log({
      action: "CAJA_CIERRE_AUTORIZADO",
      entityType: "CashSession",
      entityId: session.id,
      userId: params.adminId,
      details: {
        cajeroId: session.cashierId,
        diferencia: Number(session.difference ?? 0),
        justificacion: session.justification,
      },
    });

    return cerrada;
  }

  /** Historial de turnos, para el panel del administrador. */
  static async listHistory(limit = 30) {
    return prisma.cashSession.findMany({
      include: {
        cashier: { select: { fullName: true, email: true } },
        closedBy: { select: { fullName: true } },
      },
      orderBy: { openedAt: "desc" },
      take: limit,
    });
  }
}
