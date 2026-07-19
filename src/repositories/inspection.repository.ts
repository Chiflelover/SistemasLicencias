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
