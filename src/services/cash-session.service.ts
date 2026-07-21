import { prisma } from "@/lib/db/prisma";
import { getCurrentSystemDate } from "@/lib/date";
import { AuditService } from "@/services/audit.service";
import {
  CashMovementType,
  CashSessionStatus,
  PaymentMethod,
} from "@prisma/client";

/** Fondo con el que se sugiere abrir la caja. */
export const DEFAULT_OPENING_AMOUNT = 500.0;

/** Mínimo del motivo de un movimiento de efectivo. */
const MIN_REASON_LENGTH = 5;

/**
 * Turnos de caja.
 *
 * Las dos puntas pasan por el administrador: el cajero **solicita** la apertura
 * con un fondo y **solicita** el cierre con el efectivo contado, y ninguna de
 * las dos surte efecto hasta que un administrador la resuelve. No hay horario:
 * se puede pedir la apertura a cualquier hora.
 *
 * Mientras la apertura espera, el turno no está `OPEN` y `registerCounterPayment`
 * lo rechaza, así que no se puede cobrar contra una caja sin autorizar.
 *
 * Lo digital (Yape) se recauda igual pero no pasa por el cajón, así que se
 * informa aparte y no entra en el conteo del cierre.
 */
export class CashSessionService {
  /** Turno autorizado y operativo: el único contra el que se puede cobrar. */
  static async getOpenSession(cashierId: string) {
    return prisma.cashSession.findFirst({
      where: { cashierId, status: CashSessionStatus.OPEN },
      orderBy: { openedAt: "desc" },
    });
  }

  /** Apertura solicitada, esperando que el administrador la autorice. */
  static async getPendingOpenSession(cashierId: string) {
    return prisma.cashSession.findFirst({
      where: { cashierId, status: CashSessionStatus.PENDING_OPEN },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Cierre solicitado, esperando que el administrador lo autorice. */
  static async getPendingCloseSession(cashierId: string) {
    return prisma.cashSession.findFirst({
      where: { cashierId, status: CashSessionStatus.PENDING_APPROVAL },
      orderBy: { openedAt: "desc" },
    });
  }

  /**
   * Última apertura rechazada, solo si es lo último que le pasó al cajero.
   *
   * Se compara contra el turno más reciente en lugar de buscar el último
   * `REJECTED`: si no, el aviso quedaría pegado en la pantalla para siempre.
   * Al pedir una apertura nueva el más reciente pasa a ser esa, y el aviso se
   * va solo.
   */
  static async getLastRejectedOpening(cashierId: string) {
    const ultima = await prisma.cashSession.findFirst({
      where: { cashierId },
      orderBy: { createdAt: "desc" },
    });

    return ultima?.status === CashSessionStatus.REJECTED ? ultima : null;
  }

  /**
   * El cajero pide abrir la caja con un fondo. Queda esperando al administrador.
   */
  static async requestOpen(params: { cashierId: string; openingAmount: number }) {
    const abierta = await this.getOpenSession(params.cashierId);

    if (abierta) {
      throw new Error("Ya tienes una caja abierta. Ciérrala antes de abrir otra.");
    }

    const aperturaPendiente = await this.getPendingOpenSession(params.cashierId);

    if (aperturaPendiente) {
      throw new Error(
        "Ya pediste abrir la caja. Espera a que el administrador lo autorice."
      );
    }

    const cierrePendiente = await this.getPendingCloseSession(params.cashierId);

    if (cierrePendiente) {
      throw new Error(
        "Tu último cierre está esperando la autorización del administrador. No puedes abrir una caja nueva hasta que lo resuelva."
      );
    }

    if (!Number.isFinite(params.openingAmount) || params.openingAmount < 0) {
      throw new Error("El monto de apertura no es válido.");
    }

    // Se guarda el momento de la solicitud; al autorizarla se reemplaza por el
    // momento real de apertura, que es el que delimita qué cobros entran en el
    // turno.
    const solicitadaEn = await getCurrentSystemDate();

    const session = await prisma.cashSession.create({
      data: {
        cashierId: params.cashierId,
        openingAmount: params.openingAmount,
        openedAt: solicitadaEn,
        status: CashSessionStatus.PENDING_OPEN,
      },
    });

    await AuditService.log({
      action: "CAJA_APERTURA_SOLICITADA",
      entityType: "CashSession",
      entityId: session.id,
      userId: params.cashierId,
      details: {
        openingAmount: params.openingAmount,
        solicitadaEn: solicitadaEn.toISOString(),
      },
    });

    return session;
  }

  /** El administrador autoriza la apertura y la caja queda operativa. */
  static async approveOpen(params: { adminId: string; sessionId: string }) {
    const session = await prisma.cashSession.findUnique({
      where: { id: params.sessionId },
    });

    if (!session) {
      throw new Error("No se encontró el turno de caja.");
    }

    if (session.status !== CashSessionStatus.PENDING_OPEN) {
      throw new Error("Ese turno no está esperando autorización de apertura.");
    }

    const ahora = await getCurrentSystemDate();

    const abierta = await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: CashSessionStatus.OPEN,
        // La caja empieza a operar recién ahora: los cobros del turno se
        // cuentan desde acá, no desde que se pidió la apertura.
        openedAt: ahora,
        justification: null,
      },
    });

    await AuditService.log({
      action: "CAJA_APERTURA_AUTORIZADA",
      entityType: "CashSession",
      entityId: session.id,
      userId: params.adminId,
      details: {
        cajeroId: session.cashierId,
        openingAmount: Number(session.openingAmount),
        abiertaEn: ahora.toISOString(),
      },
    });

    return abierta;
  }

  /** El administrador rechaza la apertura. El cajero puede pedir otra. */
  static async rejectOpen(params: {
    adminId: string;
    sessionId: string;
    reason?: string;
  }) {
    const session = await prisma.cashSession.findUnique({
      where: { id: params.sessionId },
    });

    if (!session) {
      throw new Error("No se encontró el turno de caja.");
    }

    if (session.status !== CashSessionStatus.PENDING_OPEN) {
      throw new Error("Ese turno no está esperando autorización de apertura.");
    }

    const ahora = await getCurrentSystemDate();
    const motivo = (params.reason ?? "").trim() || null;

    const rechazada = await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: CashSessionStatus.REJECTED,
        // El turno queda cerrado sin haber operado nunca. Se reutiliza
        // `justification` para el motivo: la fila es terminal, así que no puede
        // pisar el motivo de un descuadre posterior.
        justification: motivo,
        closedById: params.adminId,
        closedAt: ahora,
      },
    });

    await AuditService.log({
      action: "CAJA_APERTURA_RECHAZADA",
      entityType: "CashSession",
      entityId: session.id,
      userId: params.adminId,
      details: {
        cajeroId: session.cashierId,
        openingAmount: Number(session.openingAmount),
        motivo,
      },
    });

    return rechazada;
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

    const [pagos, movimientos] = await Promise.all([
      prisma.payment.findMany({
        where: {
          registeredById: session.cashierId,
          paidAt: { gte: session.openedAt, lte: hasta },
        },
        select: { amount: true, method: true },
      }),
      prisma.cashMovement.findMany({
        where: { sessionId: session.id },
        include: { createdBy: { select: { fullName: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

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

    let entregado = 0;
    let retirado = 0;

    for (const movimiento of movimientos) {
      const monto = Number(movimiento.amount);

      if (movimiento.type === CashMovementType.DEPOSIT) {
        entregado += monto;
      } else {
        retirado += monto;
      }
    }

    const fondo = Number(session.openingAmount);

    return {
      session,
      operaciones: pagos.length,
      fondo,
      efectivo,
      digital,
      movimientos,
      entregado,
      retirado,
      // Solo el efectivo se cuenta a mano: lo digital nunca pasó por el cajón,
      // y por eso mismo tampoco lo levantan ni lo bajan los movimientos.
      esperadoEnCaja: fondo + entregado - retirado + efectivo,
    };
  }

  /**
   * El administrador entrega o retira efectivo de una caja abierta.
   *
   * Alcanza solo al efectivo: lo cobrado por Yape ya está en la cuenta digital
   * de la municipalidad y nunca pasó por el cajón, así que no hay nada que
   * entregar ni retirar de eso.
   */
  static async registerMovement(params: {
    adminId: string;
    sessionId: string;
    type: CashMovementType;
    amount: number;
    reason: string;
  }) {
    const session = await prisma.cashSession.findUnique({
      where: { id: params.sessionId },
      include: { cashier: { select: { fullName: true } } },
    });

    if (!session) {
      throw new Error("No se encontró el turno de caja.");
    }

    // Con el cierre ya solicitado, `expectedAmount` quedó congelado para que el
    // administrador lo revise contra lo contado: un movimiento posterior lo
    // dejaría mintiendo. Si el cierre se rechaza, el turno vuelve a OPEN y los
    // movimientos vuelven a contar solos.
    if (session.status !== CashSessionStatus.OPEN) {
      throw new Error(
        "Solo se puede mover efectivo de una caja abierta."
      );
    }

    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new Error("El monto tiene que ser mayor a cero.");
    }

    const reason = (params.reason ?? "").trim();

    if (reason.length < MIN_REASON_LENGTH) {
      throw new Error(
        "Indica el motivo del movimiento: queda asentado en la caja y en la auditoría."
      );
    }

    const totales = await this.getSessionTotals(session.id);

    // No se puede sacar más de lo que hay físicamente en el cajón. Si el
    // esperado quedara negativo, el cierre no podría cuadrar nunca.
    if (
      params.type === CashMovementType.WITHDRAWAL &&
      Math.round(params.amount * 100) > Math.round(totales.esperadoEnCaja * 100)
    ) {
      throw new Error(
        `No puedes retirar más de lo que hay en el cajón: S/ ${totales.esperadoEnCaja.toFixed(
          2
        )}. Lo cobrado por Yape no entra, ya está en la cuenta digital.`
      );
    }

    const ahora = await getCurrentSystemDate();

    const movimiento = await prisma.cashMovement.create({
      data: {
        sessionId: session.id,
        type: params.type,
        amount: params.amount,
        reason,
        createdById: params.adminId,
        createdAt: ahora,
      },
    });

    await AuditService.log({
      action:
        params.type === CashMovementType.DEPOSIT
          ? "CAJA_EFECTIVO_ENTREGADO"
          : "CAJA_EFECTIVO_RETIRADO",
      entityType: "CashSession",
      entityId: session.id,
      userId: params.adminId,
      details: {
        cajero: session.cashier.fullName,
        monto: params.amount,
        motivo: reason,
        esperadoAntes: totales.esperadoEnCaja,
        esperadoDespues:
          params.type === CashMovementType.DEPOSIT
            ? totales.esperadoEnCaja + params.amount
            : totales.esperadoEnCaja - params.amount,
      },
    });

    return movimiento;
  }

  /** Cajas operativas, para que el administrador les mueva el efectivo. */
  static async listOpenSessions() {
    return prisma.cashSession.findMany({
      where: { status: CashSessionStatus.OPEN },
      include: { cashier: { select: { fullName: true, email: true } } },
      orderBy: { openedAt: "asc" },
    });
  }

  /**
   * El cajero pide cerrar, declarando el efectivo que contó.
   *
   * El cierre **siempre** queda esperando al administrador, cuadre o no. Lo que
   * cambia es la exigencia: si no cuadra hay que explicar el faltante o el
   * sobrante; si cuadra no hay nada que justificar y pedir un motivo solo
   * invitaría a rellenarlo de más.
   */
  static async requestClose(params: {
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
        "El efectivo contado no coincide con el del sistema. Explica el motivo del faltante o sobrante para pedir la autorización del administrador."
      );
    }

    const actualizada = await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        cashCollected: totales.efectivo,
        digitalCollected: totales.digital,
        expectedAmount: totales.esperadoEnCaja,
        countedAmount: params.countedAmount,
        difference: diferencia,
        justification: cuadra ? null : justificacion,
        status: CashSessionStatus.PENDING_APPROVAL,
        // `closedAt` se estampa recién cuando el administrador autoriza: hasta
        // entonces el turno no está cerrado.
        closedAt: null,
        closedById: null,
      },
    });

    await AuditService.log({
      action: "CAJA_CIERRE_SOLICITADO",
      entityType: "CashSession",
      entityId: session.id,
      userId: params.cashierId,
      details: {
        esperado: totales.esperadoEnCaja,
        contado: params.countedAmount,
        diferencia,
        efectivo: totales.efectivo,
        digital: totales.digital,
        cuadra,
      },
    });

    return { session: actualizada, cuadra, diferencia, totales };
  }

  /** Aperturas esperando resolución del administrador. */
  static async listPendingOpenings() {
    return prisma.cashSession.findMany({
      where: { status: CashSessionStatus.PENDING_OPEN },
      include: { cashier: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Cierres esperando resolución del administrador. */
  static async listPendingCloses() {
    return prisma.cashSession.findMany({
      where: { status: CashSessionStatus.PENDING_APPROVAL },
      include: { cashier: { select: { fullName: true, email: true } } },
      orderBy: { openedAt: "asc" },
    });
  }

  /** El administrador autoriza el cierre. Es el único camino a CLOSED. */
  static async approveClose(params: { adminId: string; sessionId: string }) {
    const session = await prisma.cashSession.findUnique({
      where: { id: params.sessionId },
    });

    if (!session) {
      throw new Error("No se encontró el turno de caja.");
    }

    if (session.status !== CashSessionStatus.PENDING_APPROVAL) {
      throw new Error("Ese turno no está esperando autorización de cierre.");
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

  /**
   * El administrador rechaza el cierre: la caja vuelve a estar operativa.
   *
   * Se limpia el conteo declarado, que es justo lo que se le está pidiendo
   * rehacer; dejarlo mostraría un descuadre que ya nadie sostiene.
   */
  static async rejectClose(params: {
    adminId: string;
    sessionId: string;
    reason?: string;
  }) {
    const session = await prisma.cashSession.findUnique({
      where: { id: params.sessionId },
    });

    if (!session) {
      throw new Error("No se encontró el turno de caja.");
    }

    if (session.status !== CashSessionStatus.PENDING_APPROVAL) {
      throw new Error("Ese turno no está esperando autorización de cierre.");
    }

    const motivo = (params.reason ?? "").trim() || null;

    const reabierta = await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: CashSessionStatus.OPEN,
        cashCollected: null,
        digitalCollected: null,
        expectedAmount: null,
        countedAmount: null,
        difference: null,
        // Una caja OPEN con justificación es la marca de que su último intento
        // de cierre fue rechazado; se pisa cuando el cajero vuelve a pedirlo.
        justification: motivo,
        closedAt: null,
        closedById: null,
      },
    });

    await AuditService.log({
      action: "CAJA_CIERRE_RECHAZADO",
      entityType: "CashSession",
      entityId: session.id,
      userId: params.adminId,
      details: {
        cajeroId: session.cashierId,
        contado: Number(session.countedAmount ?? 0),
        diferencia: Number(session.difference ?? 0),
        motivo,
      },
    });

    return reabierta;
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
