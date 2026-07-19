import { InspectionRepository } from "@/repositories/inspection.repository";
import { ApplicationRepository } from "@/repositories/application.repository";
import { UserRepository } from "@/repositories/user.repository";
import { cloneDate, getCurrentSystemDate, addWorkDays } from "@/lib/date";
import {
  InspectionNumber,
  ApplicationStatus,
  InspectionResult,
  InspectionStatus,
} from "@prisma/client";

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 17;
const MAX_LOOKAHEAD_DAYS = 30;

/** Franjas horarias a explorar por inspector (9 por día hábil). */
const MAX_LOOKAHEAD_SLOTS = MAX_LOOKAHEAD_DAYS * 10;

/** Reintentos ante colisión con otro proceso que tomó el mismo horario. */
const MAX_SCHEDULING_ATTEMPTS = 5;

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function normalizeToNextSlot(date: Date): Date {
  const current = cloneDate(date);

  if (isWeekend(current)) {
    while (isWeekend(current)) {
      current.setDate(current.getDate() + 1);
    }

    current.setHours(WORK_START_HOUR, 0, 0, 0);
    return current;
  }

  const hour = current.getHours();
  const minute = current.getMinutes();
  const lastStartHour = WORK_END_HOUR - 1;

  if (hour < WORK_START_HOUR) {
    current.setHours(WORK_START_HOUR, 0, 0, 0);
    return current;
  }

  if (hour > lastStartHour || (hour === lastStartHour && minute > 0)) {
    current.setDate(current.getDate() + 1);

    while (isWeekend(current)) {
      current.setDate(current.getDate() + 1);
    }

    current.setHours(WORK_START_HOUR, 0, 0, 0);
    return current;
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
  }

  while (isWeekend(next)) {
    next.setDate(next.getDate() + 1);
    next.setHours(WORK_START_HOUR, 0, 0, 0);
  }

  return next;
}

/**
 * Clave de la franja horaria, normalizada a la hora en punto.
 *
 * Sin normalizar, un registro guardado con minutos distintos de cero nunca
 * colisionaría con su franja y se podría sobreasignar al inspector.
 */
function formatSlotKey(date: Date) {
  const slot = cloneDate(date);
  slot.setMinutes(0, 0, 0);
  return slot.getTime();
}

export class InspectionService {
  static async scheduleInspection(applicationId: string, forcedInspectorId?: string) {
    const application = await ApplicationRepository.findById(applicationId);

    if (!application) {
      throw new Error("Trámite no encontrado.");
    }

    const firstInspection = application.inspections.find(
      (inspection: any) => inspection.number === InspectionNumber.FIRST
    );

    const secondInspection = application.inspections.find(
      (inspection: any) => inspection.number === InspectionNumber.SECOND
    );

    const isSchedulingFirstInspection =
      application.status === ApplicationStatus.PAYMENT_COMPLETED &&
      !firstInspection;

    const isSchedulingSecondInspection =
      application.status === ApplicationStatus.FIRST_INSPECTION_REJECTED &&
      firstInspection?.status === InspectionStatus.COMPLETED &&
      firstInspection?.result === InspectionResult.REJECTED &&
      !secondInspection;

    if (!isSchedulingFirstInspection && !isSchedulingSecondInspection) {
      throw new Error(
        "No se puede programar la inspección en el estado actual del trámite."
      );
    }

    let inspectors = await UserRepository.findInspectors();

    if (forcedInspectorId) {
      inspectors = inspectors.filter((ins) => ins.id === forcedInspectorId);
    }

    if (inspectors.length === 0) {
      throw new Error("No hay inspectores disponibles en el sistema.");
    }

    const currentScheduledInspection = application.inspections.find(
      (inspection: any) => inspection.status === InspectionStatus.SCHEDULED
    );

    if (currentScheduledInspection) {
      throw new Error("Ya existe una inspección programada para este trámite.");
    }

    let inspectionNumber: InspectionNumber = InspectionNumber.FIRST;
    let targetStatus: ApplicationStatus = ApplicationStatus.INSPECTION_SCHEDULED;

    const now = await getCurrentSystemDate();

    let baseDate = now;

    if (isSchedulingSecondInspection) {
      inspectionNumber = InspectionNumber.SECOND;
      targetStatus = ApplicationStatus.SECOND_INSPECTION_SCHEDULED;

      const rejectionDate = firstInspection?.resultAt
        ? new Date(firstInspection.resultAt)
        : now;

      // Segunda inspección: 30 días hábiles después del rechazo.
      baseDate = addWorkDays(rejectionDate, 30);
    }

    const inspectorIds = inspectors.map((inspector) => inspector.id);
    const searchStart = normalizeToNextSlot(baseDate);

    // Una sola consulta para la ocupación de todos los inspectores, y otra
    // para su carga pendiente. Antes era una consulta por inspector.
    const occupiedByInspector = await InspectionRepository.findOccupiedSlots(
      inspectorIds,
      searchStart
    );
    const loadByInspector = await InspectionRepository.countScheduledByInspector(
      inspectorIds
    );

    // Slots que ya se intentaron y la base rechazó por colisión.
    const rejectedSlots = new Set<string>();

    for (let attempt = 0; attempt < MAX_SCHEDULING_ATTEMPTS; attempt += 1) {
      const bestSchedule = findEarliestSlot({
        inspectorIds,
        searchStart,
        occupiedByInspector,
        loadByInspector,
        rejectedSlots,
      });

      if (!bestSchedule) {
        throw new Error(
          "No fue posible programar la inspección en los próximos días hábiles."
        );
      }

      try {
        const inspection = await InspectionRepository.create({
          applicationId,
          inspectorId: bestSchedule.inspectorId,
          number: inspectionNumber,
          scheduledAt: bestSchedule.scheduledAt,
        });

        await ApplicationRepository.updateStatus(applicationId, targetStatus);

        return inspection;
      } catch (error: any) {
        // P2002 = otro proceso tomó ese horario entre el cálculo y el insert.
        // Se marca como ocupado y se busca el siguiente disponible.
        if (error?.code !== "P2002") {
          throw error;
        }

        const slotTime = bestSchedule.scheduledAt.getTime();

        occupiedByInspector.get(bestSchedule.inspectorId)?.add(slotTime);
        rejectedSlots.add(`${bestSchedule.inspectorId}:${slotTime}`);
      }
    }

    throw new Error(
      "No fue posible reservar un horario de inspección. Intenta nuevamente."
    );
  }
}

/**
 * Elige el horario disponible más próximo entre todos los inspectores.
 *
 * Ante empate en la fecha más temprana gana el inspector con menos
 * inspecciones pendientes; si persiste, se desempata por id para que el
 * resultado sea determinista.
 */
function findEarliestSlot(params: {
  inspectorIds: string[];
  searchStart: Date;
  occupiedByInspector: Map<string, Set<number>>;
  loadByInspector: Map<string, number>;
  rejectedSlots: Set<string>;
}): { inspectorId: string; scheduledAt: Date } | null {
  let best: {
    inspectorId: string;
    scheduledAt: Date;
    load: number;
  } | null = null;

  for (const inspectorId of params.inspectorIds) {
    const occupied =
      params.occupiedByInspector.get(inspectorId) ?? new Set<number>();

    let candidate = cloneDate(params.searchStart);
    let tries = 0;

    while (tries < MAX_LOOKAHEAD_SLOTS) {
      const slotTime = formatSlotKey(candidate);
      const isRejected = params.rejectedSlots.has(`${inspectorId}:${slotTime}`);

      if (!occupied.has(slotTime) && !isRejected) {
        const load = params.loadByInspector.get(inspectorId) ?? 0;

        const isBetter =
          !best ||
          slotTime < best.scheduledAt.getTime() ||
          (slotTime === best.scheduledAt.getTime() &&
            (load < best.load ||
              (load === best.load && inspectorId < best.inspectorId)));

        if (isBetter) {
          best = { inspectorId, scheduledAt: cloneDate(candidate), load };
        }

        break;
      }

      candidate = addOneHour(candidate);
      tries += 1;
    }
  }

  if (!best) {
    return null;
  }

  return { inspectorId: best.inspectorId, scheduledAt: best.scheduledAt };
}