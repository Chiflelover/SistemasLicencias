import { InspectionRepository } from "@/repositories/inspection.repository";
import { ApplicationRepository } from "@/repositories/application.repository";
import { UserRepository } from "@/repositories/user.repository";
import { cloneDate, getCurrentSystemDate } from "@/lib/date";
import { InspectionNumber, ApplicationStatus, InspectionResult } from "@prisma/client";

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 17;
const MAX_LOOKAHEAD_DAYS = 30;

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function normalizeToNextSlot(date: Date): Date {
  const current = cloneDate(date);

  if (isWeekend(current)) {
    const next = cloneDate(current);
    do {
      next.setDate(next.getDate() + 1);
    } while (isWeekend(next));
    next.setHours(WORK_START_HOUR, 0, 0, 0);
    return next;
  }

  const hour = current.getHours();
  const minute = current.getMinutes();

  const lastStartHour = WORK_END_HOUR - 1;
  if (hour < WORK_START_HOUR) {
    current.setHours(WORK_START_HOUR, 0, 0, 0);
    return current;
  }

  if (hour > lastStartHour || (hour === lastStartHour && minute > 0)) {
    const next = cloneDate(current);
    next.setDate(next.getDate() + 1);
    do {
      if (!isWeekend(next)) break;
      next.setDate(next.getDate() + 1);
    } while (true);
    next.setHours(WORK_START_HOUR, 0, 0, 0);
    return next;
  }

  if (minute > 0 || current.getSeconds() > 0 || current.getMilliseconds() > 0) {
    current.setHours(hour + 1, 0, 0, 0);
  }

  return current;
}

function addOneHour(date: Date): Date {
  const next = cloneDate(date);
  next.setHours(next.getHours() + 1, 0, 0, 0);
  if (next.getHours() >= WORK_END_HOUR) {
    next.setDate(next.getDate() + 1);
    next.setHours(WORK_START_HOUR, 0, 0, 0);
    while (isWeekend(next)) {
      next.setDate(next.getDate() + 1);
    }
  }
  if (isWeekend(next)) {
    while (isWeekend(next)) {
      next.setDate(next.getDate() + 1);
    }
    next.setHours(WORK_START_HOUR, 0, 0, 0);
  }
  return next;
}

function formatSlotKey(date: Date) {
  return date.getTime();
}

export class InspectionService {
  static async scheduleInspection(applicationId: string) {
    const application = await ApplicationRepository.findById(applicationId);
    if (!application) {
      throw new Error("Trámite no encontrado.");
    }

    const firstInspection = application.inspections.find((inspection) => inspection.number === InspectionNumber.FIRST);
    const secondInspection = application.inspections.find((inspection) => inspection.number === InspectionNumber.SECOND);

    const isSchedulingSecondInspection =
      application.status === ApplicationStatus.FIRST_INSPECTION_REJECTED &&
      firstInspection?.result === InspectionResult.REJECTED &&
      !secondInspection;

    if (!isSchedulingSecondInspection && application.status !== ApplicationStatus.PAYMENT_COMPLETED) {
      throw new Error("La inspección solo puede programarse después de que el pago esté completo o tras una primera inspección rechazada.");
    }

    const inspectors = await UserRepository.findInspectors();
    if (inspectors.length === 0) {
      throw new Error("No hay inspectores disponibles en el sistema.");
    }

    const currentInspection = application.inspections.find((inspection) => inspection.status === "SCHEDULED");
    if (currentInspection) {
      throw new Error("Ya existe una inspección programada para este trámite.");
    }

    let inspectionNumber: InspectionNumber = InspectionNumber.FIRST;
    let targetStatus: ApplicationStatus = ApplicationStatus.INSPECTION_SCHEDULED;

    if (firstInspection && firstInspection.result === InspectionResult.REJECTED) {
      if (secondInspection) {
        throw new Error("Este trámite ya tiene una segunda inspección programada o completada.");
      }
      inspectionNumber = InspectionNumber.SECOND;
      targetStatus = ApplicationStatus.SECOND_INSPECTION_SCHEDULED;
    } else if (firstInspection && firstInspection.result !== InspectionResult.REJECTED) {
      throw new Error("Este trámite ya cuenta con una inspección previa aprobada o en curso.");
    }

    const now = await getCurrentSystemDate();
    let bestSchedule: { inspectorId: string; scheduledAt: Date } | null = null;

    for (const inspector of inspectors) {
      const scheduledSlots = await InspectionRepository.findScheduledSlots(inspector.id);
      const occupied = new Set(scheduledSlots.map((slot) => formatSlotKey(cloneDate(slot))));

      let candidate = normalizeToNextSlot(now);
      let tries = 0;
      while (tries < MAX_LOOKAHEAD_DAYS * 10) {
        const key = formatSlotKey(candidate);
        if (!occupied.has(key)) {
          if (!bestSchedule || candidate.getTime() < bestSchedule.scheduledAt.getTime()) {
            bestSchedule = { inspectorId: inspector.id, scheduledAt: cloneDate(candidate) };
          }
          break;
        }
        candidate = addOneHour(candidate);
        tries += 1;
      }
    }

    if (!bestSchedule) {
      throw new Error("No fue posible programar la inspección en los próximos días hábiles.");
    }

    const inspection = await InspectionRepository.create({
      applicationId,
      inspectorId: bestSchedule.inspectorId,
      number: inspectionNumber,
      scheduledAt: bestSchedule.scheduledAt,
    });

    await ApplicationRepository.updateStatus(applicationId, targetStatus);

    return inspection;
  }
}
