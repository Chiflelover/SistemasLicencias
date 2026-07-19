import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { PaymentRepository } from "@/repositories/payment.repository";
import { InspectionService } from "@/services/inspection.service";
import { LicenseService } from "@/services/license.service";
import { getCurrentSystemDate } from "@/lib/date";
import { ApplicationStatus, PaymentType } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Registra un pago hecho en ventanilla.
 *
 * El cajero solo puede cobrar trámites que él mismo registró; no puede aprobar
 * ni intervenir en las inspecciones, que siguen a cargo del inspector.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const applicationId = String(body.applicationId || "").trim();

    if (!applicationId) {
      return NextResponse.json(
        { error: "Falta el identificador del trámite." },
        { status: 400 }
      );
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { documents: { select: { type: true } } },
    });

    if (!application) {
      return NextResponse.json(
        { error: "No se encontró el trámite." },
        { status: 404 }
      );
    }

    if (application.registeredById !== user.id) {
      return NextResponse.json(
        { error: "Solo puedes cobrar trámites que registraste tú." },
        { status: 403 }
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
            "Faltan documentos obligatorios: el plano del local y la ficha RUC.",
        },
        { status: 400 }
      );
    }

    const isRenewal = application.status === ApplicationStatus.RENEWAL_AVAILABLE;

    if (application.status !== ApplicationStatus.PENDING_PAYMENT && !isRenewal) {
      return NextResponse.json(
        {
          error: `El trámite no está pendiente de pago. Estado actual: ${application.status}`,
        },
        { status: 400 }
      );
    }

    const now = await getCurrentSystemDate();
    const operationNumber = await PaymentRepository.generateOperationNumber();

    const payment = await PaymentRepository.create({
      applicationId: application.id,
      type: isRenewal ? PaymentType.RENEWAL : PaymentType.INITIAL_APPLICATION,
      amount: 180.0, // Tarifa TUPA
      operationNumber,
      paidAt: now,
    });

    if (isRenewal) {
      await LicenseService.renewLicense(application.id);
    } else {
      await prisma.application.update({
        where: { id: application.id },
        data: { status: ApplicationStatus.PAYMENT_COMPLETED, updatedAt: now },
      });

      // La inspección la agenda el sistema y la resuelve el inspector.
      await InspectionService.scheduleInspection(application.id);
    }

    return NextResponse.json({
      success: true,
      message: "Pago presencial registrado correctamente.",
      operationNumber,
      paymentId: payment.id,
    });
  } catch (error: any) {
    console.error("Error registrando pago presencial:", error);

    return NextResponse.json(
      { error: error?.message || "Error interno al registrar el pago." },
      { status: 500 }
    );
  }
}
