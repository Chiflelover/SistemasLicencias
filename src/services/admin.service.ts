import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth";
import { AuditService } from "@/services/audit.service";
import { getCurrentSystemDate } from "@/lib/date";
import {
  isProtectedStaff,
  isProtectedFromDeactivation,
  PROTECTED_STAFF_MESSAGE,
  PROTECTED_DEACTIVATION_MESSAGE,
  LAST_CASHIER_MESSAGE,
  MIN_ACTIVE_CASHIERS,
  ONLY_CASHIERS_MESSAGE,
  MAX_CASHIERS,
  MAX_CASHIERS_MESSAGE,
} from "@/lib/staff";
import { Role } from "@prisma/client";

/** Roles de personal que el administrador puede gestionar. */
export const MANAGEABLE_ROLES: Role[] = [Role.INSPECTOR, Role.CAJERO];

export function isManageableRole(value: string): value is "INSPECTOR" | "CAJERO" {
  return value === Role.INSPECTOR || value === Role.CAJERO;
}

export class AdminService {
  /**
   * Cajas activas sin contar la que se está por modificar.
   *
   * Se cuenta contra la base y no sobre la lista de la pantalla: dos pestañas
   * abiertas podrían desactivar cada una "la otra" caja y bajar del mínimo.
   */
  private static async countOtherActiveCashiers(excludeUserId: string) {
    return prisma.user.count({
      where: { role: Role.CAJERO, active: true, id: { not: excludeUserId } },
    });
  }

  /** Personal del sistema con un resumen de su actividad. */
  static async listStaff() {
    const users = await prisma.user.findMany({
      where: { role: { in: MANAGEABLE_ROLES } },
      select: {
        id: true,
        email: true,
        fullName: true,
        dni: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        _count: {
          select: {
            inspections: true,
            fines: true,
            registrations: true,
            cashPayments: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
    });

    return users;
  }

  /** Perfil detallado de un miembro del personal. */
  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        dni: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user || !MANAGEABLE_ROLES.includes(user.role)) {
      return null;
    }

    if (user.role === Role.INSPECTOR) {
      const [pendientes, realizadas, multas] = await Promise.all([
        prisma.inspection.count({ where: { inspectorId: userId, status: "SCHEDULED" } }),
        prisma.inspection.count({ where: { inspectorId: userId, status: "COMPLETED" } }),
        prisma.fine.count({ where: { inspectorId: userId } }),
      ]);

      return { ...user, stats: { pendientes, realizadas, multas } };
    }

    const [registradas, cobros, recaudado] = await Promise.all([
      prisma.application.count({ where: { registeredById: userId } }),
      prisma.payment.count({ where: { registeredById: userId } }),
      prisma.payment.aggregate({
        where: { registeredById: userId },
        _sum: { amount: true },
      }),
    ]);

    return {
      ...user,
      stats: {
        registradas,
        cobros,
        recaudado: Number(recaudado._sum.amount ?? 0),
      },
    };
  }

  /** Alta de un inspector o cajero. */
  static async createStaff(params: {
    adminId: string;
    email: string;
    password: string;
    fullName: string;
    dni: string;
    phone: string;
    role: "INSPECTOR" | "CAJERO";
  }) {
    // El personal solo se amplía con cajas. Se valida acá y no solo en el
    // formulario: el desplegable se saltea con una petición directa.
    if (params.role !== Role.CAJERO) {
      throw new Error(ONLY_CASHIERS_MESSAGE);
    }

    // El tope se cuenta contra la base en el momento del alta: dos pestañas
    // creando a la vez podrían pasarse si se confiara en lo que ve la pantalla.
    const cajasExistentes = await prisma.user.count({
      where: { role: Role.CAJERO },
    });

    if (cajasExistentes >= MAX_CASHIERS) {
      throw new Error(MAX_CASHIERS_MESSAGE);
    }

    const existing = await prisma.user.findUnique({
      where: { email: params.email },
    });

    if (existing) {
      throw new Error("Ya existe un usuario con ese correo electrónico.");
    }

    const passwordHash = await hashPassword(params.password);

    const user = await prisma.user.create({
      data: {
        email: params.email,
        passwordHash,
        fullName: params.fullName,
        dni: params.dni,
        phone: params.phone,
        role: params.role,
        active: true,
      },
      select: { id: true, email: true, fullName: true, role: true, active: true },
    });

    await AuditService.log({
      action: "USUARIO_CREADO",
      entityType: "User",
      entityId: user.id,
      userId: params.adminId,
      details: { email: user.email, rol: user.role, nombre: user.fullName },
    });

    return user;
  }

  /**
   * Cambio de contraseña a pedido del titular.
   *
   * El administrador no ve la contraseña anterior: solo asigna una nueva.
   */
  static async resetPassword(params: {
    adminId: string;
    userId: string;
    newPassword: string;
  }) {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, email: true, role: true },
    });

    if (!user || !MANAGEABLE_ROLES.includes(user.role)) {
      throw new Error("Usuario no encontrado o no gestionable.");
    }

    if (params.newPassword.length < 8) {
      throw new Error("La contraseña debe tener al menos 8 caracteres.");
    }

    const passwordHash = await hashPassword(params.newPassword);

    await prisma.user.update({
      where: { id: params.userId },
      data: { passwordHash, updatedAt: await getCurrentSystemDate() },
    });

    await AuditService.log({
      action: "PASSWORD_RESTABLECIDA",
      entityType: "User",
      entityId: user.id,
      userId: params.adminId,
      details: { email: user.email, rol: user.role },
    });

    return true;
  }

  /** Activa o desactiva una cuenta sin borrar su historial. */
  static async setActive(params: {
    adminId: string;
    userId: string;
    active: boolean;
  }) {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, email: true, role: true },
    });

    if (!user || !MANAGEABLE_ROLES.includes(user.role)) {
      throw new Error("Usuario no encontrado o no gestionable.");
    }

    // Solo se bloquea apagarla: reactivarla siempre tiene que poder hacerse,
    // por si quedó inactiva de antes.
    if (!params.active && isProtectedFromDeactivation(user.email)) {
      throw new Error(PROTECTED_DEACTIVATION_MESSAGE);
    }

    if (!params.active && user.role === Role.CAJERO) {
      const otrasActivas = await this.countOtherActiveCashiers(user.id);

      if (otrasActivas < MIN_ACTIVE_CASHIERS) {
        throw new Error(LAST_CASHIER_MESSAGE);
      }
    }

    await prisma.user.update({
      where: { id: params.userId },
      data: { active: params.active },
    });

    await AuditService.log({
      action: params.active ? "USUARIO_ACTIVADO" : "USUARIO_DESACTIVADO",
      entityType: "User",
      entityId: user.id,
      userId: params.adminId,
      details: { email: user.email, rol: user.role },
    });

    return true;
  }

  /**
   * Elimina una cuenta de personal.
   *
   * Las inspecciones y multas usan onDelete: Restrict, así que un inspector
   * con historial no se puede borrar sin destruir expedientes. En ese caso se
   * informa y se sugiere desactivar, que conserva la trazabilidad.
   */
  static async deleteStaff(params: { adminId: string; userId: string }) {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        active: true,
        _count: { select: { inspections: true, fines: true } },
      },
    });

    if (!user || !MANAGEABLE_ROLES.includes(user.role)) {
      throw new Error("Usuario no encontrado o no gestionable.");
    }

    // Se valida acá y no solo en la pantalla: el botón deshabilitado se saltea
    // con una petición directa.
    if (isProtectedStaff(user.email)) {
      throw new Error(PROTECTED_STAFF_MESSAGE);
    }

    // Borrar una caja activa deja el mismo agujero que desactivarla. Si ya
    // estaba inactiva no cambia el conteo y no hace falta el chequeo.
    if (user.role === Role.CAJERO && user.active) {
      const otrasActivas = await this.countOtherActiveCashiers(user.id);

      if (otrasActivas < MIN_ACTIVE_CASHIERS) {
        throw new Error(LAST_CASHIER_MESSAGE);
      }
    }

    if (user._count.inspections > 0 || user._count.fines > 0) {
      throw new Error(
        `No se puede eliminar: tiene ${user._count.inspections} inspección(es) y ` +
          `${user._count.fines} multa(s) asociadas. Desactiva la cuenta para conservar el historial.`
      );
    }

    await prisma.user.delete({ where: { id: params.userId } });

    await AuditService.log({
      action: "USUARIO_ELIMINADO",
      entityType: "User",
      entityId: user.id,
      userId: params.adminId,
      details: { email: user.email, rol: user.role, nombre: user.fullName },
    });

    return true;
  }

  /**
   * Recaudación por caja.
   *
   * Cada cajero es una caja: los pagos guardan qué cajero los recibió, así que
   * agrupar por cajero da el total de cada ventanilla.
   */
  static async getRevenueByCashRegister(params?: { from?: Date; to?: Date }) {
    const cajeros = await prisma.user.findMany({
      where: { role: Role.CAJERO },
      select: { id: true, fullName: true, email: true, active: true },
      orderBy: { fullName: "asc" },
    });

    const filtroFecha =
      params?.from && params?.to
        ? { paidAt: { gte: params.from, lte: params.to } }
        : {};

    const cajas = [];
    let totalGeneral = 0;

    for (const cajero of cajeros) {
      const [agregado, porMetodo] = await Promise.all([
        prisma.payment.aggregate({
          where: { registeredById: cajero.id, ...filtroFecha },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.payment.groupBy({
          by: ["method"],
          where: { registeredById: cajero.id, ...filtroFecha },
          _sum: { amount: true },
          _count: { _all: true },
        }),
      ]);

      const total = Number(agregado._sum.amount ?? 0);
      totalGeneral += total;

      cajas.push({
        id: cajero.id,
        nombre: cajero.fullName,
        email: cajero.email,
        activo: cajero.active,
        operaciones: agregado._count._all,
        total,
        porMetodo: porMetodo.map((m) => ({
          metodo: m.method ?? "SIN_METODO",
          operaciones: m._count._all,
          total: Number(m._sum.amount ?? 0),
        })),
      });
    }

    return { cajas, totalGeneral };
  }
}
