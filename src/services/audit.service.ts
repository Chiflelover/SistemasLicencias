import { prisma } from "@/lib/db/prisma";

/**
 * Registro de auditoría de acciones sensibles.
 *
 * Nunca interrumpe la operación que lo invoca: si el log falla, la acción
 * de negocio ya ocurrió y no tiene sentido revertirla por no poder auditarla.
 */
export class AuditService {
  static async log(params: {
    action: string;
    entityType: string;
    entityId: string;
    userId?: string;
    details?: Record<string, unknown>;
  }) {
    try {
      return await prisma.auditLog.create({
        data: {
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          userId: params.userId ?? null,
          details: (params.details ?? undefined) as any,
        },
      });
    } catch (error) {
      console.error("No se pudo registrar la auditoría:", error);
      return null;
    }
  }

  /** Historial de una entidad concreta, del más reciente al más antiguo. */
  static async findByEntity(entityType: string, entityId: string) {
    return prisma.auditLog.findMany({
      where: { entityType, entityId },
      include: { user: { select: { fullName: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Acciones registradas por un usuario. */
  static async findByUser(userId: string, limit = 100) {
    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
