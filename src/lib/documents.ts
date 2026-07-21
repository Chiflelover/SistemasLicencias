import { ApplicationStatus, DocumentType } from "@prisma/client";

/**
 * Política de carga de documentos según el estado del trámite.
 *
 * Antes no existía ninguna restricción: se podían adjuntar archivos a un
 * trámite con licencia emitida o rechazado en forma definitiva.
 */

/** Carga inicial: el expediente todavía se está armando. */
const INITIAL_UPLOAD_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.DRAFT,
  ApplicationStatus.DOCUMENTS_COMPLETE,
  ApplicationStatus.PENDING_PAYMENT,
];

/**
 * Subsanación: el inspector observó la primera inspección y el administrado
 * tiene hasta la segunda para corregir.
 *
 * Se incluyen los dos estados porque FIRST_INSPECTION_REJECTED es transitorio:
 * al observar, el sistema agenda la segunda inspección en el acto y el trámite
 * queda en SECOND_INSPECTION_SCHEDULED, que es donde el administrado espera.
 */
const OBSERVED_UPLOAD_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.FIRST_INSPECTION_REJECTED,
  ApplicationStatus.SECOND_INSPECTION_SCHEDULED,
];

/**
 * Renovación: la licencia venció y se renueva en ventanilla.
 *
 * La carga es **opcional**: si el local no cambió, los documentos del trámite
 * original siguen sirviendo y no hay que volver a presentarlos. Se habilita
 * para el caso contrario —cambió el plano, cambió la ficha RUC— sin obligar a
 * nadie a subir nada.
 */
const RENEWAL_UPLOAD_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.EXPIRED,
];

/** Tipos que se pueden adjuntar o reemplazar mientras la carga está abierta. */
const ALLOWED_DOCUMENT_TYPES: DocumentType[] = [
  DocumentType.FLOOR_PLAN,
  DocumentType.RUC_RECORD,
  DocumentType.ADDITIONAL,
];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  FLOOR_PLAN: "Plano",
  RUC_RECORD: "Ficha RUC",
  ADDITIONAL: "Documento adicional",
};

/** True si el trámite admite carga de documentos en su estado actual. */
export function canUploadDocuments(status: ApplicationStatus): boolean {
  return (
    INITIAL_UPLOAD_STATUSES.includes(status) ||
    OBSERVED_UPLOAD_STATUSES.includes(status) ||
    RENEWAL_UPLOAD_STATUSES.includes(status)
  );
}

/** True si el trámite está en renovación (licencia vencida). */
export function isUnderRenewal(status: ApplicationStatus): boolean {
  return RENEWAL_UPLOAD_STATUSES.includes(status);
}

/** True si el trámite está en período de subsanación por observación. */
export function isUnderObservation(status: ApplicationStatus): boolean {
  return OBSERVED_UPLOAD_STATUSES.includes(status);
}

/** Tipos admitidos en el estado actual. Vacío si la carga está cerrada. */
export function allowedDocumentTypes(
  status: ApplicationStatus
): DocumentType[] {
  return canUploadDocuments(status) ? [...ALLOWED_DOCUMENT_TYPES] : [];
}

/**
 * Valida que se pueda adjuntar ese tipo en ese estado.
 * Lanza con un mensaje explicativo si no corresponde.
 */
export function assertDocumentUploadAllowed(
  status: ApplicationStatus,
  type: DocumentType
): void {
  if (!canUploadDocuments(status)) {
    throw new Error(
      `La carga de documentos no está habilitada para este trámite. Estado actual: ${status}.`
    );
  }

  if (!ALLOWED_DOCUMENT_TYPES.includes(type)) {
    throw new Error(
      `Tipo de documento no permitido: ${type}. Solo se admiten plano, certificados y documentos adicionales.`
    );
  }
}
