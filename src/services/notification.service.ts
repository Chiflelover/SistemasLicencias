import { prisma } from "@/lib/db/prisma";
import { WhatsAppService } from "@/services/whatsapp.service";
import { MailService } from "@/services/mail.service";
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
  /**
   * Fecha del sistema en formato YYYY-MM-DD, para las claves de deduplicación.
   *
   * Se arma con los métodos locales y no con toISOString(), que siempre
   * devuelve UTC: el resto de syncDailyNotifications delimita el día con
   * setHours() en hora de Lima, y entre las 19:00 y la medianoche las dos
   * formas caían en días distintos, liberando la clave y repitiendo el aviso.
   */
  private static async dayKey(): Promise<string> {
    const date = await getCurrentSystemDate();

    const anio = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const dia = String(date.getDate()).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
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
          // Devuelve null, no la fila: quien llama necesita distinguir "creé
          // el aviso" de "ya estaba" para no repetir efectos externos, como
          // el mensaje de WhatsApp. Devolver la fila existente hacía que se
          // reenviara en cada sondeo de la campana.
          return null;
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
      title: "Debes corregir documentos",
      message:
        `El trámite ${params.applicationNumber} fue observado. ` +
        `La carga de documentos se habilitó nuevamente. ` +
        (params.observations ? `Observaciones: ${params.observations}` : ""),
      applicationId: params.applicationId,
    });
  }

  /**
   * A los administradores: un cajero pidió abrir o cerrar su caja.
   *
   * Las dos puntas del turno las autoriza el administrador, así que sin este
   * aviso tendría que entrar a `/admin/cajas` cada tanto a ver si alguien lo
   * está esperando.
   *
   * **Sin clave de deduplicación, a propósito.** Los avisos que la usan se
   * recalculan en cada consulta y hay que frenarlos; estos salen de un clic del
   * cajero, uno por evento. Además el mismo turno puede pedir el cierre más de
   * una vez —si el administrador lo rechaza vuelve a `OPEN`—, y una clave
   * armada con el id del turno se comería el segundo pedido.
   */
  static async notifyAdminsCashRequest(params: {
    tipo: "APERTURA" | "CIERRE";
    cashierId: string;
    detalle: string;
  }) {
    const [cajero, admins] = await Promise.all([
      prisma.user.findUnique({
        where: { id: params.cashierId },
        select: { fullName: true },
      }),
      prisma.user.findMany({
        where: { role: Role.ADMIN, active: true },
        select: { id: true },
      }),
    ]);

    const apertura = params.tipo === "APERTURA";
    const quien = cajero?.fullName ?? "Un cajero";

    for (const admin of admins) {
      await this.notify({
        userId: admin.id,
        type: apertura
          ? NotificationType.ADMIN_CASH_OPEN_REQUEST
          : NotificationType.ADMIN_CASH_CLOSE_REQUEST,
        title: apertura
          ? "Un cajero pidió abrir su caja"
          : "Un cajero pidió cerrar su caja",
        message: `${quien}: ${params.detalle}`,
      });
    }
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
      message: `La licencia ${params.licenseNumber} está vencida. Debes iniciar el trámite de renovación.`,
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
  /**
   * Aviso al administrado de que su inspección es hoy, más el WhatsApp.
   *
   * La clave de deduplicación es por inspección y por día, así que no importa
   * quién dispare el sincronizado —el inspector o el propio administrado—:
   * el aviso sale una sola vez, y una vez por cada inspección de la jornada.
   */
  private static async avisarInspeccionDeHoy(params: {
    applicantId: string;
    applicationId: string;
    applicationNumber: string;
    inspectionId: string;
    scheduledAt: Date;
    day: string;
  }) {
    const hora = params.scheduledAt.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const creada = await this.notify({
      userId: params.applicantId,
      type: NotificationType.INSPECTION_TODAY,
      title: "Hoy tienes inspección",
      message: `El trámite ${params.applicationNumber} tiene inspección hoy a las ${hora}.`,
      applicationId: params.applicationId,
      dedupeKey: `inspeccion-hoy:${params.inspectionId}:${params.day}`,
    });

    // Solo cuando notify() creó una fila nueva. Sin esta guarda el aviso
    // saldría en cada sondeo de la campana, cada pocos segundos.
    //
    // El administrado se entera por correo; el WhatsApp quedó reservado para
    // el inspector. El correo de contacto vive en el trámite, no en el
    // usuario sintético del flujo público.
    if (creada) {
      const app = await prisma.application.findUnique({
        where: { id: params.applicationId },
        select: { contactEmail: true },
      });

      if (app?.contactEmail) {
        await MailService.notifyInspectionScheduled(
          app.contactEmail,
          params.scheduledAt
        );
      }
    }
  }

  static async syncDailyNotifications(userId: string, role: Role) {
    const systemDate = await getCurrentSystemDate();
    const day = await this.dayKey();

    const from = new Date(systemDate);
    from.setHours(0, 0, 0, 0);

    const to = new Date(systemDate);
    to.setHours(23, 59, 59, 999);

    if (role === Role.INSPECTOR) {
      const inspeccionesDeHoy = await prisma.inspection.findMany({
        where: {
          inspectorId: userId,
          status: "SCHEDULED",
          scheduledAt: { gte: from, lte: to },
        },
        select: {
          id: true,
          scheduledAt: true,
          application: {
            select: { id: true, number: true, applicantId: true },
          },
        },
        orderBy: { scheduledAt: "asc" },
      });

      const pendientes = inspeccionesDeHoy.length;

      if (pendientes > 0) {
        // Resumen para el inspector: uno por día, porque le interesa su carga
        // de la jornada y no cada inspección por separado.
        const resumenCreado = await this.notify({
          userId,
          type: NotificationType.INSPECTOR_TODAY_AGENDA,
          title: "Tienes inspecciones pendientes para hoy",
          message: `${pendientes} ${
            pendientes === 1 ? "inspección programada" : "inspecciones programadas"
          } para hoy.`,
          dedupeKey: `agenda-inspector:${userId}:${day}`,
        });

        if (resumenCreado) {
          await WhatsAppService.notifyInspectorAgenda(
            pendientes,
            inspeccionesDeHoy[0].scheduledAt
          );
        }

        // El aviso al administrado va aparte y es uno por inspección: el
        // resumen del inspector se deduplica por día, así que colgarse de él
        // dejaba sin mensaje a la segunda inspección de la jornada.
        //
        // Se emiten desde acá porque el administrado del flujo público no
        // puede iniciar sesión: si esperáramos a que sincronice su propia
        // campana, no saldrían nunca.
        for (const inspeccion of inspeccionesDeHoy) {
          await this.avisarInspeccionDeHoy({
            applicantId: inspeccion.application.applicantId,
            applicationId: inspeccion.application.id,
            applicationNumber: inspeccion.application.number,
            inspectionId: inspeccion.id,
            scheduledAt: inspeccion.scheduledAt,
            day,
          });
        }
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
        await this.avisarInspeccionDeHoy({
          applicantId: userId,
          applicationId: inspeccion.application.id,
          applicationNumber: inspeccion.application.number,
          inspectionId: inspeccion.id,
          scheduledAt: inspeccion.scheduledAt,
          day,
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
