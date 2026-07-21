import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ApplicationStatus, DocumentType, PaymentType } from "@prisma/client";
import { UserRepository } from "@/repositories/user.repository";
import { InspectionService } from "@/services/inspection.service";
import { LicenseService } from "@/services/license.service";
import { getCurrentSystemDate } from "@/lib/date";
import { getTupaAmount } from "@/lib/tarifa";
import { PaymentRepository } from "@/repositories/payment.repository";

export const dynamic = "force-dynamic";

// ── CAMBIAR EL TAMAÑO MÁXIMO DE ARCHIVO ─────────────────────────────────────
// Poner los MB que pidan en lugar del 5:
//
//   const MAX_FILE_SIZE = 3 * 1024 * 1024;
//
// OJO: el límite está repetido y hay que cambiarlo en los 5 archivos del
// servidor, en la validación del navegador y en los 3 textos que dicen "5MB"
// (incluido el mensaje de error de más abajo). Si se cambia solo acá, la
// pantalla sigue rechazando con el límite viejo y el usuario ve un error que
// no coincide con lo que acepta el servidor.
//
//   src/app/api/cajero/registro-presencial/route.ts
//   src/app/api/cajero/subsanar/[applicationId]/route.ts
//   src/app/api/public/tramite/[applicationId]/documentos/route.ts
//   src/app/api/public/tramite/[applicationId]/pago/manual/route.ts
//   src/app/api/public/tramite/[applicationId]/subsanar/route.ts
//   src/components/ManualPaymentForm.tsx                     (validación y texto)
//   src/components/PublicDocumentUploadForm.tsx              (texto)
//   src/app/cajero/registro-presencial/page.tsx              (texto)
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

    // ── PARA HACER LOS DOCUMENTOS OPCIONALES ────────────────────────────────
    // Para que se pueda pagar sin haber subido nada, borrar este bloque
    // entero. Para exigir uno solo, cambiar la condición:
    //
    //   if (!hasFloorPlan) {                    // solo el plano
    //   if (!hasFloorPlan && !hasRucRecord) {   // al menos uno de los dos
    //
    // Va junto con el `documentsComplete` de
    // src/app/api/public/tramite/[applicationId]/documentos/route.ts, que es el
    // que promueve el trámite a PENDING_PAYMENT y lista los demás archivos a
    // tocar.
    if (!hasFloorPlan || !hasRucRecord) {
      return NextResponse.json(
        {
          error:
            "Primero debes subir el plano del local y la ficha RUC antes de pagar.",
        },
        { status: 400 }
      );
    }

    // Solo el pago inicial. La renovación se cobra únicamente en ventanilla,
    // así que por la web no se paga ni una licencia vencida ni una por vencer.
    if (application.status === ApplicationStatus.EXPIRED) {
      return NextResponse.json(
        {
          error:
            "Tu licencia venció. La renovación se hace en ventanilla, en la Municipalidad Provincial de Trujillo.",
        },
        { status: 400 }
      );
    }

    if (application.status !== ApplicationStatus.PENDING_PAYMENT) {
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

    // Por acá solo pasa el pago inicial: la renovación quedó bloqueada más
    // arriba porque es de ventanilla.
    const paymentType = PaymentType.INITIAL_APPLICATION;

    const payment = await PaymentRepository.create({
      applicationId: application.id,
      type: paymentType,
      // Tarifa vigente al momento de pagar, no la de cuando se inició el
      // trámite: el administrador puede haberla cambiado en el medio.
      amount: await getTupaAmount(),
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
