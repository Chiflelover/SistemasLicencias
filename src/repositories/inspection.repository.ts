import { prisma } from "../lib/db/prisma";
import { getCurrentSystemDate } from "@/lib/date";
import { Inspection, InspectionNumber, InspectionResult } from "@prisma/client";

export class InspectionRepository {
  static async create(data: {
    applicationId: string;
    inspectorId: string;
    number: InspectionNumber;
    scheduledAt: Date;
  }): Promise<Inspection> {
    return prisma.inspection.create({
      data: {
        applicationId: data.applicationId,
        inspectorId: data.inspectorId,
        number: data.number,
        scheduledAt: data.scheduledAt,
        status: "SCHEDULED",
      },
    });
  }

  static async findById(id: string) {
    return prisma.inspection.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            business: true,
            applicant: { select: { id: true, fullName: true, email: true, phone: true } },
            documents: { select: { id: true, type: true, name: true, fileName: true, mimeType: true, size: true, createdAt: true } },
            payments: true,
            license: {
              select: {
                id: true,
                licenseNumber: true,
                status: true,
                issuedAt: true,
                expiresAt: true,
                pdfFileName: true,
              },
            },
          },
        },
        inspector: { select: { id: true, fullName: true } },
      },
    });
  }

  static async findByInspectorId(inspectorId: string) {
    return prisma.inspection.findMany({
      where: { inspectorId, status: "SCHEDULED" },
      include: {
        application: { include: { business: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });
  }

  /** Inspecciones pendientes del inspector para un día concreto, por hora. */
  static async findPendingForDay(inspectorId: string, from: Date, to: Date) {
    return prisma.inspection.findMany({
      where: {
        inspectorId,
        status: "SCHEDULED",
        scheduledAt: { gte: from, lte: to },
      },
      include: {
        application: { include: { business: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });
  }

  // findCompletedForDay se eliminó: el inspector no conserva historial. Al
  // resolver una inspección, esta sale de su vista; el registro de lo hecho
  // vive en el panel del administrador (findAllForAdmin).

  /**
   * Todas las inspecciones para el administrador: pasadas, de hoy y futuras.
   *
   * Es el único lugar del sistema donde queda el historial completo, porque el
   * inspector solo ve lo que tiene pendiente hoy.
   */
  static async findAllForAdmin(params: {
    estado?: "SCHEDULED" | "COMPLETED";
    inspectorId?: string;
    desde?: Date;
    hasta?: Date;
    limit?: number;
  }) {
    return prisma.inspection.findMany({
      where: {
        ...(params.estado ? { status: params.estado } : {}),
        ...(params.inspectorId ? { inspectorId: params.inspectorId } : {}),
        ...(params.desde || params.hasta
          ? {
              scheduledAt: {
                ...(params.desde ? { gte: params.desde } : {}),
                ...(params.hasta ? { lte: params.hasta } : {}),
              },
            }
          : {}),
      },
      select: {
        id: true,
        number: true,
        status: true,
        result: true,
        observations: true,
        scheduledAt: true,
        resultAt: true,
        inspector: { select: { id: true, fullName: true } },
        application: {
          select: {
            number: true,
            status: true,
            business: { select: { ruc: true, legalName: true } },
          },
        },
      },
      orderBy: { scheduledAt: "desc" },
      take: params.limit ?? 200,
    });
  }

  static async findScheduledSlots(inspectorId: string): Promise<Date[]> {
    const scheduled = await prisma.inspection.findMany({
      where: { inspectorId, status: "SCHEDULED" },
      select: { scheduledAt: true },
    });
    return scheduled.map((s) => s.scheduledAt);
  }

  /**
   * Ocupación de varios inspectores desde una fecha dada, en una sola consulta.
   *
   * Incluye las inspecciones COMPLETED además de las SCHEDULED: aunque ya se
   * hayan resuelto, el inspector estuvo ocupado en ese horario y la restricción
   * única de la base lo rechazaría igual.
   */
  static async findOccupiedSlots(
    inspectorIds: string[],
    from: Date
  ): Promise<Map<string, Set<number>>> {
    const inspections = await prisma.inspection.findMany({
      where: {
        inspectorId: { in: inspectorIds },
        scheduledAt: { gte: from },
      },
      select: { inspectorId: true, scheduledAt: true },
    });

    const occupied = new Map<string, Set<number>>();

    for (const inspectorId of inspectorIds) {
      occupied.set(inspectorId, new Set<number>());
    }

    for (const inspection of inspections) {
      // Se normaliza a la hora en punto para que un registro con minutos
      // distintos de cero igual colisione con su franja.
      const slot = new Date(inspection.scheduledAt);
      slot.setMinutes(0, 0, 0);

      occupied.get(inspection.inspectorId)?.add(slot.getTime());
    }

    return occupied;
  }

  /** Cantidad de inspecciones pendientes por inspector, para repartir carga. */
  static async countScheduledByInspector(
    inspectorIds: string[]
  ): Promise<Map<string, number>> {
    const grouped = await prisma.inspection.groupBy({
      by: ["inspectorId"],
      where: { inspectorId: { in: inspectorIds }, status: "SCHEDULED" },
      _count: { _all: true },
    });

    const loads = new Map<string, number>();

    for (const inspectorId of inspectorIds) {
      loads.set(inspectorId, 0);
    }

    for (const row of grouped) {
      loads.set(row.inspectorId, row._count._all);
    }

    return loads;
  }

  static async complete(
    id: string,
    result: InspectionResult,
    observations?: string
  ): Promise<Inspection> {
    return prisma.inspection.update({
      where: { id },
      data: {
        status: "COMPLETED",
        result,
        observations: observations ?? null,
        resultAt: await getCurrentSystemDate(),
      },
    });
  }

  static async findByApplicationId(applicationId: string) {
    return prisma.inspection.findMany({
      where: { applicationId },
      include: { inspector: { select: { fullName: true } } },
      orderBy: { createdAt: "asc" },
    });
  }
}
