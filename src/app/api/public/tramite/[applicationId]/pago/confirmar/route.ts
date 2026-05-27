import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ApplicationStatus } from "@prisma/client";

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
    ];

    if (!allowedStatuses.includes(application.status)) {
      return NextResponse.json(
        {
          error: `No se puede confirmar el pago porque el trámite está en estado: ${application.status}`,
        },
        { status: 400 }
      );
    }

    if (application.status !== ApplicationStatus.PAYMENT_COMPLETED) {
      await prisma.application.update({
        where: {
          id: application.id,
        },
        data: {
          status: ApplicationStatus.PAYMENT_COMPLETED,
        },
      });
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