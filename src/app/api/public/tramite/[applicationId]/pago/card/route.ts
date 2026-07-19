import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSystemDate } from "@/lib/date";
import { InspectionService } from "@/services/inspection.service";
import {
  ApplicationStatus,
  InspectionStatus,
  PaymentType,
} from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { applicationId: string } }
) {
  try {
    const application = await prisma.application.findUnique({
      where: {
        id: params.applicationId,
      },
      include: {
        documents: {
          select: {
            type: true,
          },
        },
        payments: {
          select: {
            id: true,
          },
        },
        inspections: {
          select: {
            id: true,
            status: true,
            inspectorId: true,
          },
        },
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: "No se encontró el trámite." },
        { status: 404 }
      );
    }

    const hasFloorPlan = application.documents.some(
      (document) => document.type === "FLOOR_PLAN"
    );

    const hasRucRecord = application.documents.some(
      (document) => document.type === "RUC_RECORD"
    );

    if (!hasFloorPlan || !hasRucRecord) {
      return NextResponse.json(
        {
          error:
            "Primero debes subir el plano del local y la ficha RUC antes de confirmar el pago.",
        },
        { status: 400 }
      );
    }

    const allowedStatuses: ApplicationStatus[] = [
      ApplicationStatus.PENDING_PAYMENT,
      ApplicationStatus.RENEWAL_AVAILABLE,
      ApplicationStatus.PAYMENT_COMPLETED,
      ApplicationStatus.INSPECTION_SCHEDULED,
      ApplicationStatus.SECOND_INSPECTION_SCHEDULED,
    ];

    if (!allowedStatuses.includes(application.status)) {
      return NextResponse.json(
        {
          error: `No se puede confirmar el pago porque el trámite está en estado: ${application.status}`,
        },
        { status: 400 }
      );
    }

    const activeInspectors = await prisma.user.count({
      where: {
        role: "INSPECTOR",
        active: true,
      },
    });

    if (activeInspectors === 0) {
      return NextResponse.json(
        {
          error:
            "No hay inspectores activos. Crea o activa un inspector antes de confirmar el pago.",
        },
        { status: 400 }
      );
    }

    const now = await getCurrentSystemDate();

    if (application.payments.length === 0) {
      await prisma.payment.create({
        data: {
          applicationId: application.id,
          type: PaymentType.INITIAL_APPLICATION,
          amount: 180, // Monto oficial del trámite TUPA (el cobro real en Mercado Pago es S/ 2.00)
          operationNumber: `MP-${Date.now()}-${application.number}`,
          paidAt: now,
        },
      });
    }

    const existingScheduledInspection = application.inspections.find(
      (inspection) => inspection.status === InspectionStatus.SCHEDULED
    );

    if (existingScheduledInspection) {
      await prisma.application.update({
        where: {
          id: application.id,
        },
        data: {
          status: ApplicationStatus.INSPECTION_SCHEDULED,
          updatedAt: now,
        },
      });
    } else {
      await prisma.application.update({
        where: {
          id: application.id,
        },
        data: {
          status: ApplicationStatus.PAYMENT_COMPLETED,
          updatedAt: now,
        },
      });

      await InspectionService.scheduleInspection(application.id);
    }

    const redirectUrl = new URL(
      `/tramite/${application.id}/inspecciones`,
      request.url
    );

    return NextResponse.redirect(redirectUrl, {
      status: 303,
    });
  } catch (error: any) {
    console.error("Error confirmando pago público:", error);

    return NextResponse.json(
      {
        error:
          error?.message || "Error interno al confirmar el pago del trámite.",
      },
      { status: 500 }
    );
  }
}