import { prisma } from "@/lib/db/prisma";
import { getCurrentSystemDate } from "@/lib/date";
import { NotificationType, Role } from "@prisma/client";

/**
 * Notificaciones internas del sistema.
 *
 * No hay servicios externos ni envío de correo: los avisos viven en la base y
 * se muestran en la campana de la barra superior.
 *
 * Hay dos formas de generarlos:
 *
 *  - Por evento: al agendar, reprogramar u observar una inspección, el servicio
 *    correspondiente llama a este módulo en el momento.
 *
 *  - Por consulta: los avisos que dependen de "hoy" (la agenda del día, una
 *    licencia vencida) no pueden dispararse solos porque no hay tareas
 *    programadas. Se calculan al abrir la campana, con una clave de
 *    deduplicación que evita repetirlos.
 */
export class NotificationService {
  /** Fecha del sistema en formato YYYY-MM-DD, para las claves de deduplicación. */
  private static async dayKey(): Promise<string> {
    const date = await getCurrentSystemDate();
    return date.toISOString().slice(0, 10);
  }

  /**
   * Crea un aviso. Si se pasa dedupeKey y ya existe uno con esa clave, no hace
   * nada: así el mismo aviso no se repite aunque se recalcule muchas veces.
   */
  static async notify(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    applicationId?: string;
    dedupeKey?: string;
  }) {
    try {
      if (params.dedupeKey) {
        const existing = await prisma.notification.findUnique({
          where: { dedupeKey: params.dedupeKey },
        });

        if (existing) {
          return existing;
        }
      }

      return await prisma.notification.create({
        data: {
          userId: params.userId,
          type: params.type,
          title: params.title,
          message: params.message,
          applicationId: params.applicationId ?? null,
          dedupeKey: params.dedupeKey ?? null,
        },
      });
    } catch (error: any) {
      // P2002: otra petición creó el mismo aviso en paralelo. No es un error.
      if (error?.code === "P2002") {
        return null;
      }

      // Notificar nunca debe tumbar la operación de negocio que lo disparó.
      console.error("No se pudo crear la notificación:", error);
      return null;
    }
  }

  // ── Avisos por evento ──────────────────────────────────────────────────────

  /** Al inspector: se le asignó una inspección nueva. */
  static async notifyNewAssignment(params: {
    inspectorId: string;
    applicationId: string;
    applicationNumber: string;
    legalName: string;
    scheduledAt: Date;
  }) {
    const cuando = params.scheduledAt.toLocaleString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return this.notify({
      userId: params.inspectorId,
      type: NotificationType.INSPECTOR_NEW_ASSIGNMENT,
      title: "Nueva inspección asignada",
      message: `${params.legalName} (${params.applicationNumber}) el ${cuando}.`,
      applicationId: params.applicationId,
    });
  }

  /** Al administrado: su inspección fue reprogramada. */
  static async notifyRescheduled(params: {
    applicantId: string;
    applicationId: string;
    applicationNumber: string;
    scheduledAt: Date;
  }) {
    const cuando = params.scheduledAt.toLocaleString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return this.notify({
      userId: params.applicantId,
      type: NotificationType.INSPECTION_RESCHEDULED,
      title: "Tu inspección fue reprogramada",
      message: `El trámite ${params.applicationNumber} tiene una nueva inspección el ${cuando}.`,
      applicationId: params.applicationId,
    });
  }

  /** Al administrado: debe corregir documentos tras una observación. */
  static async notifyDocumentsToFix(params: {
    applicantId: string;
    applicationId: string;
    applicationNumber: string;
    observations: string;
  }) {
    return this.notify({
      userId: params.applicantId,
      type: NotificationType.DOCUMENTS_TO_FIX,
      title: "Debés corregir documentos",
      message:
        `El trámite ${params.applicationNumber} fue observado. ` +
        `La carga de documentos se habilitó nuevamente. ` +
        (params.observations ? `Observaciones: ${params.observations}` : ""),
      applicationId: params.applicationId,
    });
  }

  /** Al administrado: su licencia venció. */
  static async notifyLicenseExpired(params: {
    applicantId: string;
    applicationId: string;
    licenseNumber: string;
  }) {
    const day = await this.dayKey();

    return this.notify({
      userId: params.applicantId,
      type: NotificationType.LICENSE_EXPIRED,
      title: "Tu licencia venció",
      message: `La licencia ${params.licenseNumber} está vencida. Debés iniciar el trámite de renovación.`,
      applicationId: params.applicationId,
      dedupeKey: `licencia-vencida:${params.applicationId}:${day}`,
    });
  }

  // ── Avisos que dependen del día ────────────────────────────────────────────

  /**
   * Recalcula los avisos de "hoy" para un usuario.
   *
   * Se llama al consultar la campana. La clave de deduplicación incluye la
   * fecha, así que se crea uno por día como máximo.
   */
  static async syncDailyNotifications(userId: string, role: Role) {
    const systemDate = await getCurrentSystemDate();
    const day = await this.dayKey();

    const from = new Date(systemDate);
    from.setHours(0, 0, 0, 0);

    const to = new Date(systemDate);
    to.setHours(23, 59, 59, 999);

    if (role === Role.INSPECTOR) {
      const pendientes = await prisma.inspection.count({
        where: {
          inspectorId: userId,
          status: "SCHEDULED",
          scheduledAt: { gte: from, lte: to },
        },
      });

      if (pendientes > 0) {
        await this.notify({
          userId,
          type: NotificationType.INSPECTOR_TODAY_AGENDA,
          title: "Tenés inspecciones pendientes para hoy",
          message: `${pendientes} ${
            pendientes === 1 ? "inspección programada" : "inspecciones programadas"
          } para hoy.`,
          dedupeKey: `agenda-inspector:${userId}:${day}`,
        });
      }

      return;
    }

    if (role === Role.APPLICANT) {
      // Inspecciones de hoy en los trámites del administrado.
      const inspeccionesHoy = await prisma.inspection.findMany({
        where: {
          status: "SCHEDULED",
          scheduledAt: { gte: from, lte: to },
          application: { applicantId: userId },
        },
        include: {
          application: {
            select: { id: true, number: true, business: { select: { legalName: true } } },
          },
        },
      });

      for (const inspeccion of inspeccionesHoy) {
        const hora = inspeccion.scheduledAt.toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
        });

        await this.notify({
          userId,
          type: NotificationType.INSPECTION_TODAY,
          title: "Hoy tenés inspección",
          message: `El trámite ${inspeccion.application.number} tiene inspección hoy a las ${hora}.`,
          applicationId: inspeccion.application.id,
          dedupeKey: `inspeccion-hoy:${inspeccion.id}:${day}`,
        });
      }

      // Licencias vencidas.
      const vencidas = await prisma.license.findMany({
        where: {
          expiresAt: { lt: systemDate },
          application: { applicantId: userId },
        },
        include: { application: { select: { id: true } } },
      });

      for (const licencia of vencidas) {
        await this.notifyLicenseExpired({
          applicantId: userId,
          applicationId: licencia.application.id,
          licenseNumber: licencia.licenseNumber,
        });
      }
    }
  }

  // ── Consulta y lectura ─────────────────────────────────────────────────────

  static async list(userId: string, limit = 30) {
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return { items, unreadCount };
  }

  static async markAsRead(userId: string, notificationId: string) {
    const now = await getCurrentSystemDate();

    // El where incluye userId para que nadie marque avisos ajenos.
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: now },
    });

    return result.count > 0;
  }

  static async markAllAsRead(userId: string) {
    const now = await getCurrentSystemDate();

    const result = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: now },
    });

    return result.count;
  }
}
