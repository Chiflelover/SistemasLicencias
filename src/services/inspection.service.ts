import { InspectionRepository } from "@/repositories/inspection.repository";
import { ApplicationRepository } from "@/repositories/application.repository";
import { UserRepository } from "@/repositories/user.repository";
import { cloneDate, getCurrentSystemDate, addWorkDays } from "@/lib/date";
import { NotificationService } from "@/services/notification.service";
import {
  InspectionNumber,
  ApplicationStatus,
  InspectionResult,
  InspectionStatus,
} from "@prisma/client";

const MAX_LOOKAHEAD_DAYS = 30;

// ── CAMBIAR LAS FRANJAS DE INSPECCIÓN ───────────────────────────────────────
// Cada visita dura dos horas: 8-10, 10-12, 12-14, almuerzo de 14 a 15, y la
// última de 15 a 17, que cierra justo con la jornada.
//
// Para cambiar los horarios alcanza con tocar esta lista; el resto del
// agendador se acomoda solo. Por ejemplo, sin almuerzo y con una franja más:
//
//   const SLOT_START_HOURS = [8, 10, 12, 14];
//
// Se lista hora por hora en vez de calcularlas con un paso fijo justamente
// porque el almuerzo parte el día y no hay fórmula que lo describa.
const SLOT_START_HOURS = [8, 10, 12, 15];

/** Inicio de la jornada: la primera franja del día. */
const WORK_START_HOUR = SLOT_START_HOURS[0];

/** Última hora en la que puede empezar una inspección. */
const LAST_START_HOUR = SLOT_START_HOURS[SLOT_START_HOURS.length - 1];

/** Franjas horarias a explorar por inspector. */
const MAX_LOOKAHEAD_SLOTS = MAX_LOOKAHEAD_DAYS * SLOT_START_HOURS.length;

/** Primera franja que empieza a esa hora o después. `null` si ya pasaron todas. */
function franjaDesde(hour: number, conMinutos: boolean): number | null {
  // Con minutos encima ya se perdió la franja en curso: se busca la siguiente.
  const objetivo = conMinutos ? hour + 1 : hour;
  return SLOT_START_HOURS.find((inicio) => inicio >= objetivo) ?? null;
}

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
  const conMinutos =
    current.getMinutes() > 0 ||
    current.getSeconds() > 0 ||
    current.getMilliseconds() > 0;

  // Franja siguiente hacia arriba: las 9:00 y las 9:30 caen igual en la de las
  // 10:00, y cualquier hora del almuerzo cae en la de las 15:00.
  const inicio = franjaDesde(hour, conMinutos);

  if (inicio === null) {
    current.setDate(current.getDate() + 1);

    while (isWeekend(current)) {
      current.setDate(current.getDate() + 1);
    }

    current.setHours(WORK_START_HOUR, 0, 0, 0);
    return current;
  }

  current.setHours(inicio, 0, 0, 0);
  return current;
}

/** Salta a la franja siguiente, cruzando al próximo día hábil si hace falta. */
function addOneSlot(date: Date): Date {
  const next = cloneDate(date);
  const siguiente = franjaDesde(next.getHours() + 1, false);

  if (siguiente === null) {
    next.setDate(next.getDate() + 1);
    next.setHours(WORK_START_HOUR, 0, 0, 0);
  } else {
    next.setHours(siguiente, 0, 0, 0);
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

    if (isSchedulingFirstInspection) {
      // La visita nunca cae el mismo día del pago: el inspector arma su agenda
      // con un día hábil de anticipación. Sin esto, pagar de madrugada
      // programaba la inspección para esa misma mañana a las 8:00, porque la
      // hora todavía era anterior al inicio de la jornada.
      baseDate = addWorkDays(now, 1);
      baseDate.setHours(WORK_START_HOUR, 0, 0, 0);
    }

    if (isSchedulingSecondInspection) {
      inspectionNumber = InspectionNumber.SECOND;
      targetStatus = ApplicationStatus.SECOND_INSPECTION_SCHEDULED;

      const rejectionDate = firstInspection?.resultAt
        ? new Date(firstInspection.resultAt)
        : now;

      // Se cuenta desde el inicio del día del rechazo, no desde la hora
      // exacta: así los 30 días hábiles caen siempre en la fecha esperada a
      // primera hora, sin que un rechazo de tarde empuje la cita un día más
      // (a las 19:00 el "+30" caería fuera de horario y saltaría de franja).
      rejectionDate.setHours(0, 0, 0, 0);

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

        // Aviso al inspector de su nueva asignación. Si falla, no revierte
        // la programación: la inspección ya quedó agendada.
        await NotificationService.notifyNewAssignment({
          inspectorId: bestSchedule.inspectorId,
          applicationId,
          applicationNumber: application.number,
          legalName: application.business.legalName,
          scheduledAt: bestSchedule.scheduledAt,
        });

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

  /**
   * Agenda la visita de control de una licencia renovada.
   *
   * Se sortea un día dentro del año de vigencia y se busca la primera franja
   * libre desde ahí. La fecha es al azar a propósito: el administrado no sabe
   * cuándo lo van a visitar, que es lo que hace inopinada a la inspección.
   *
   * No toca el estado del trámite —la licencia ya está vigente y pagada— y no
   * interrumpe la renovación si algo falla: es un efecto secundario del cobro,
   * no parte de él.
   */
  static async scheduleUnannouncedInspection(params: {
    applicationId: string;
    desde: Date;
    hasta: Date;
  }) {
    const application = await ApplicationRepository.findById(params.applicationId);

    if (!application) {
      throw new Error("Trámite no encontrado.");
    }

    const inspectors = await UserRepository.findInspectors();

    if (inspectors.length === 0) {
      throw new Error("No hay inspectores disponibles.");
    }

    // Día al azar dentro del período. El sorteo es sobre días completos: la
    // hora la define la franja libre que se encuentre a partir de ahí.
    const dias = Math.max(
      1,
      Math.floor(
        (params.hasta.getTime() - params.desde.getTime()) / (1000 * 60 * 60 * 24)
      )
    );

    const sorteado = cloneDate(params.desde);
    sorteado.setDate(sorteado.getDate() + Math.floor(Math.random() * dias));
    sorteado.setHours(0, 0, 0, 0);

    const inspectorIds = inspectors.map((inspector) => inspector.id);
    const searchStart = normalizeToNextSlot(sorteado);

    const occupiedByInspector = await InspectionRepository.findOccupiedSlots(
      inspectorIds,
      searchStart
    );
    const loadByInspector = await InspectionRepository.countScheduledByInspector(
      inspectorIds
    );

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
          "No fue posible programar la inspección inopinada en el período de la licencia."
        );
      }

      try {
        const inspection = await InspectionRepository.create({
          applicationId: params.applicationId,
          inspectorId: bestSchedule.inspectorId,
          number: InspectionNumber.UNANNOUNCED,
          scheduledAt: bestSchedule.scheduledAt,
        });

        await NotificationService.notifyNewAssignment({
          inspectorId: bestSchedule.inspectorId,
          applicationId: params.applicationId,
          applicationNumber: application.number,
          legalName: application.business.legalName,
          scheduledAt: bestSchedule.scheduledAt,
        });

        return inspection;
      } catch (error: any) {
        if (error?.code !== "P2002") {
          throw error;
        }

        const slotTime = bestSchedule.scheduledAt.getTime();
        occupiedByInspector.get(bestSchedule.inspectorId)?.add(slotTime);
        rejectedSlots.add(`${bestSchedule.inspectorId}:${slotTime}`);
      }
    }

    throw new Error(
      "No fue posible reservar un horario para la inspección inopinada."
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

      candidate = addOneSlot(candidate);
      tries += 1;
    }
  }

  if (!best) {
    return null;
  }

  return { inspectorId: best.inspectorId, scheduledAt: best.scheduledAt };
}