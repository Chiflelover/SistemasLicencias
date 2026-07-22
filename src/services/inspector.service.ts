import { InspectionRepository } from "@/repositories/inspection.repository";
import { ApplicationRepository } from "@/repositories/application.repository";
import { LicenseService } from "@/services/license.service";
import { InspectionService } from "@/services/inspection.service";
import { getCurrentSystemDate } from "@/lib/date";
import { vigentes } from "@/lib/documents";
import { AuditService } from "@/services/audit.service";
import { NotificationService } from "@/services/notification.service";
import { FineService } from "@/services/fine.service";
import { MailService } from "@/services/mail.service";
import {
  GRAVEDADES,
  esGravedadValida,
  montoDeMulta,
  type GravedadMulta,
} from "@/lib/uit";
import {
  ApplicationStatus,
  InspectionNumber,
  InspectionResult,
  InspectionStatus,
} from "@prisma/client";

export class InspectorService {
  static async getAssignedInspections(inspectorId: string) {
    return InspectionRepository.findByInspectorId(inspectorId);
  }

  /**
   * Agenda del día para el inspector: solo lo que le queda por hacer.
   *
   * Una inspección resuelta desaparece de su vista y no deja historial: el
   * inspector trabaja contra lo pendiente, y el registro de lo hecho vive en el
   * panel del administrador, que ve todas las inspecciones.
   *
   * Usa la fecha del sistema (simulada en desarrollo) y no la real, para que
   * el DevPanel siga sirviendo para demostrar el flujo.
   */
  static async getTodayAgenda(inspectorId: string) {
    const systemDate = await getCurrentSystemDate();

    const from = new Date(systemDate);
    from.setHours(0, 0, 0, 0);

    const to = new Date(systemDate);
    to.setHours(23, 59, 59, 999);

    const pending = await InspectionRepository.findPendingForDay(
      inspectorId,
      from,
      to
    );

    return {
      date: systemDate,
      pending,
      pendingCount: pending.length,
    };
  }

  static async getInspectionDetails(inspectionId: string) {
    const inspection = await InspectionRepository.findById(inspectionId);

    if (!inspection) return inspection;

    // El inspector revisa el expediente vigente, no la pila de reemplazos: un
    // plano y una ficha, los últimos. Los anteriores siguen en la base.
    return {
      ...inspection,
      application: {
        ...inspection.application,
        documents: vigentes(inspection.application.documents),
      },
    };
  }

  static async reviewInspection(
    inspectionId: string,
    action: "approve" | "reject",
    observations?: string,
    paymentInvalid = false,
    fineGravedad?: GravedadMulta
  ) {
    const inspection = await InspectionRepository.findById(inspectionId);

    if (!inspection) {
      throw new Error("Inspección no encontrada.");
    }

    if (inspection.status === InspectionStatus.COMPLETED) {
      throw new Error("Esta inspección ya fue revisada y no puede modificarse.");
    }

    if (action === "reject" && !observations?.trim()) {
      throw new Error(
        "Debe registrar observaciones para rechazar la inspección."
      );
    }

    const esInopinada = inspection.number === InspectionNumber.UNANNOUNCED;

    // Se valida ANTES de marcarla como resuelta: si no, el intento fallido la
    // cerraba igual y el segundo rebotaba con "ya fue revisada", dejando la
    // inspección terminada y sin la multa.
    if (esInopinada && action === "reject" && !esGravedadValida(fineGravedad)) {
      throw new Error(
        "Indica la gravedad de la multa para registrar la observación."
      );
    }

    // El rechazo por pago inválido supone que hay un comprobante subido por el
    // ciudadano. Si el cobro lo registró un cajero (`registeredById`), el
    // dinero se recibió en el mostrador y quedó en su arqueo: no existe papel
    // que declarar inválido. La pantalla ya esconde la casilla; esto cierra la
    // puerta a una petición directa, que si no cerraría en firme —y sin
    // segunda oportunidad— un trámite pagado en ventanilla.
    const cobradoEnVentanilla =
      inspection.application.payments.length > 0 &&
      inspection.application.payments.every((pago) => pago.registeredById);

    if (paymentInvalid && cobradoEnVentanilla) {
      throw new Error(
        "Este trámite se pagó en ventanilla: no hay comprobante que declarar inválido. Si el local tiene problemas, regístralo como observación."
      );
    }

    const result =
      action === "approve"
        ? InspectionResult.APPROVED
        : InspectionResult.REJECTED;

    const updatedInspection = await InspectionRepository.complete(
      inspectionId,
      result,
      observations?.trim() || ""
    );

    if (!updatedInspection) {
      throw new Error("No se pudo guardar la revisión de la inspección.");
    }

    // ── Inspección inopinada ────────────────────────────────────────────────
    // Es una visita de control sobre una licencia ya vigente y pagada, así que
    // no mueve el trámite en ninguna dirección: aprobar deja constancia y nada
    // más, y observar registra una multa contra la licencia. La licencia no se
    // revoca ni se vence: sigue valiendo hasta su fecha.
    if (esInopinada) {
      if (action === "reject") {
        const licencia = await LicenseService.getLicenseByApplication(
          inspection.applicationId
        );

        if (!licencia) {
          throw new Error(
            "No se encontró la licencia del trámite para registrar la multa."
          );
        }

        // El monto se calcula acá con la UIT vigente, no llega del navegador.
        // Se guarda en soles: si la UIT sube el año que viene, esta multa
        // conserva el importe que tenía, que es como funciona en la realidad.
        const gravedad = fineGravedad as GravedadMulta;
        const monto = await montoDeMulta(gravedad);
        const escala = GRAVEDADES.find((g) => g.clave === gravedad);

        await FineService.createFine(
          inspection.inspectorId,
          licencia.id,
          monto,
          `Multa por inspección inopinada · ${escala?.nombre} (${escala?.porcentaje}% UIT)`,
          observations?.trim() || ""
        );
      }

      return updatedInspection;
    }

    if (action === "approve") {
      await ApplicationRepository.updateStatus(
        inspection.applicationId,
        ApplicationStatus.LICENSE_ISSUED
      );

      await LicenseService.createLicenseForApplication(inspection.applicationId);

      return updatedInspection;
    }

    // Comprobante de pago inválido: no hay segunda oportunidad. Subsanar sirve
    // para corregir documentos, pero un pago que nunca se hizo no se corrige
    // subiendo otro papel. El trámite se cierra en firme y el RUC queda libre
    // —DEFINITIVELY_REJECTED no bloquea— para iniciar uno nuevo desde cero.
    if (action === "reject" && paymentInvalid) {
      await ApplicationRepository.updateStatus(
        inspection.applicationId,
        ApplicationStatus.DEFINITIVELY_REJECTED
      );

      await AuditService.log({
        action: "TRAMITE_RECHAZADO_POR_PAGO_INVALIDO",
        entityType: "Inspection",
        entityId: inspection.id,
        userId: inspection.inspectorId,
        details: {
          applicationId: inspection.applicationId,
          numero: inspection.number,
          observaciones: observations?.trim() || "",
          nuevoEstado: ApplicationStatus.DEFINITIVELY_REJECTED,
          motivo: "El comprobante de pago no es válido.",
        },
      });

      // Sin aviso, el administrado no se entera de que tiene que empezar de
      // nuevo: no puede iniciar sesión y el rechazo definitivo no tiene
      // pantalla propia.
      if (inspection.application.contactEmail) {
        await MailService.notifyPaymentRejected(
          inspection.application.contactEmail,
          observations?.trim() || ""
        );
      }

      return updatedInspection;
    }

    // Primera observación: el trámite queda observado y se reabre la carga de
    // documentos para que el administrado subsane antes de la segunda visita.
    if (action === "reject" && inspection.number === InspectionNumber.FIRST) {
      await ApplicationRepository.updateStatus(
        inspection.applicationId,
        ApplicationStatus.FIRST_INSPECTION_REJECTED
      );

      // Agenda la segunda exactamente 30 días hábiles después del resultado.
      const secondInspection = await InspectionService.scheduleInspection(
        inspection.applicationId
      );

      await AuditService.log({
        action: "INSPECCION_OBSERVADA",
        entityType: "Inspection",
        entityId: inspection.id,
        userId: inspection.inspectorId,
        details: {
          applicationId: inspection.applicationId,
          numero: "PRIMERA",
          observaciones: observations?.trim() || "",
          nuevoEstado: ApplicationStatus.SECOND_INSPECTION_SCHEDULED,
          cargaDeDocumentos: "reabierta para subsanación",
          segundaInspeccion: secondInspection?.scheduledAt ?? null,
        },
      });

      // Avisos al administrado: qué corregir y cuándo es la nueva visita.
      const applicantId = inspection.application.applicant.id;
      const applicationNumber = inspection.application.number;

      await NotificationService.notifyDocumentsToFix({
        applicantId,
        applicationId: inspection.applicationId,
        applicationNumber,
        observations: observations?.trim() || "",
      });

      if (secondInspection?.scheduledAt) {
        await NotificationService.notifyRescheduled({
          applicantId,
          applicationId: inspection.applicationId,
          applicationNumber,
          scheduledAt: secondInspection.scheduledAt,
        });

        // Correo con la observación y la fecha de la nueva visita. El correo
        // de contacto lo declaró el ciudadano al iniciar el trámite; el
        // usuario del flujo público no puede leer los avisos internos.
        if (inspection.application.contactEmail) {
          await MailService.notifyInspectionRejected(
            inspection.application.contactEmail,
            observations?.trim() || "",
            secondInspection.scheduledAt
          );
        }
      }

      return updatedInspection;
    }

    // Segunda observación: no hay tercera oportunidad.
    if (action === "reject" && inspection.number === InspectionNumber.SECOND) {
      await ApplicationRepository.updateStatus(
        inspection.applicationId,
        ApplicationStatus.DEFINITIVELY_REJECTED
      );

      await AuditService.log({
        action: "TRAMITE_RECHAZADO_DEFINITIVO",
        entityType: "Inspection",
        entityId: inspection.id,
        userId: inspection.inspectorId,
        details: {
          applicationId: inspection.applicationId,
          numero: "SEGUNDA",
          observaciones: observations?.trim() || "",
          nuevoEstado: ApplicationStatus.DEFINITIVELY_REJECTED,
          motivo: "Segunda inspección observada: no corresponde una tercera.",
        },
      });

      // Es el cierre definitivo del trámite: sin este correo el administrado
      // solo se enteraría si se le ocurre consultar su RUC.
      if (inspection.application.contactEmail) {
        await MailService.notifyDefinitiveRejection(
          inspection.application.contactEmail,
          observations?.trim() || ""
        );
      }

      return updatedInspection;
    }

    return updatedInspection;
  }
}