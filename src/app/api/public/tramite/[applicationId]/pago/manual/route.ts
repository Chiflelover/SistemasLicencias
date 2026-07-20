import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ApplicationStatus, DocumentType, PaymentType } from "@prisma/client";
import { UserRepository } from "@/repositories/user.repository";
import { InspectionService } from "@/services/inspection.service";
import { LicenseService } from "@/services/license.service";
import { getCurrentSystemDate } from "@/lib/date";
import { PaymentRepository } from "@/repositories/payment.repository";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: { applicationId: string } }
) {
  try {
    const application = await prisma.application.findUnique({
      where: { id: params.applicationId },
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
            "Primero debes subir el plano del local y la ficha RUC antes de pagar.",
        },
        { status: 400 }
      );
    }

    if (
      application.status !== ApplicationStatus.PENDING_PAYMENT &&
      application.status !== ApplicationStatus.RENEWAL_AVAILABLE
    ) {
      return NextResponse.json(
        {
          error: `Este trámite no está pendiente de pago. Estado actual: ${application.status}`,
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Selecciona una imagen de comprobante válida." },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "El comprobante de pago está vacío." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "La imagen no debe superar los 5MB." },
        { status: 400 }
      );
    }

    const allowedMimeTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "application/pdf",
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Solo se permiten archivos de imagen (PNG, JPG, JPEG) o PDF." },
        { status: 400 }
      );
    }

    // Teléfono de contacto del solicitante. Se valida acá aunque el
    // formulario ya lo controle: una petición directa se saltea el cliente.
    const telefono = String(formData.get("telefono") ?? "").trim();

    if (!/^\d{9}$/.test(telefono)) {
      return NextResponse.json(
        { error: "Ingresa un teléfono de contacto de 9 dígitos." },
        { status: 400 }
      );
    }

    // Reemplaza el "000000000" de relleno con que el flujo público crea al
    // solicitante. Se escribe antes de registrar el pago: si algo falla acá,
    // todavía no se asentó dinero.
    await prisma.user.update({
      where: { id: application.applicantId },
      data: { phone: telefono },
    });

    // 1. Obtener Inspectores y seleccionar uno al azar
    const inspectors = await UserRepository.findInspectors();
    if (inspectors.length === 0) {
      return NextResponse.json(
        { error: "No hay inspectores registrados en el sistema." },
        { status: 400 }
      );
    }

    const randomInspector = inspectors[Math.floor(Math.random() * inspectors.length)];

    // 2. Procesar el archivo del comprobante
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Guardar como documento del trámite de tipo ADDITIONAL
    const savedDocument = await prisma.document.create({
      data: {
        applicationId: application.id,
        type: DocumentType.ADDITIONAL,
        name: "Comprobante de Pago (Ya pagué)",
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        content: buffer,
      },
    });

    // 3. Generar número de operación y registrar Pago
    const now = await getCurrentSystemDate();
    const operationNumber = await PaymentRepository.generateOperationNumber();

    const paymentType =
      application.status === ApplicationStatus.RENEWAL_AVAILABLE
        ? PaymentType.RENEWAL
        : PaymentType.INITIAL_APPLICATION;

    const payment = await PaymentRepository.create({
      applicationId: application.id,
      type: paymentType,
      amount: 180.00, // Monto oficial del trámite TUPA
      operationNumber,
      paidAt: now,
    });

    // 4. Cambiar el estado del trámite y programar inspección (o renovación)
    let updatedApplication;
    if (paymentType === PaymentType.INITIAL_APPLICATION) {
      updatedApplication = await prisma.application.update({
        where: { id: application.id },
        data: {
          status: ApplicationStatus.PAYMENT_COMPLETED,
        },
      });

      // Programar la inspección forzando al inspector seleccionado de forma aleatoria
      await InspectionService.scheduleInspection(application.id, randomInspector.id);
    } else {
      updatedApplication = await LicenseService.renewLicense(application.id);
    }

    return NextResponse.json({
      success: true,
      message: "Pago registrado y comprobante enviado correctamente. La inspección ha sido agendada.",
      paymentId: payment.id,
      operationNumber,
      inspector: {
        id: randomInspector.id,
        fullName: randomInspector.fullName,
      },
      application: updatedApplication,
    });
  } catch (error: any) {
    console.error("Error al registrar el pago manual:", error);
    return NextResponse.json(
      {
        error: error?.message || "Error interno del servidor al procesar el pago.",
      },
      { status: 500 }
    );
  }
}
