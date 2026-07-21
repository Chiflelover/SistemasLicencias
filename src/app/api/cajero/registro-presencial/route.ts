import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApplicationService } from "@/services/application.service";
import { ApplicationRepository } from "@/repositories/application.repository";
import { DocumentRepository } from "@/repositories/document.repository";
import { RucService } from "@/services/ruc.service";
import {
  belongsToDistrictTrujillo,
  OUT_OF_DISTRICT_MESSAGE,
} from "@/lib/territory";
import { checkRucEligibility } from "@/lib/ruc-eligibility";
import { ApplicationStatus, DocumentType } from "@prisma/client";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

function validateFile(file: unknown, label: string): File {
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error(`Adjunta el archivo de ${label}.`);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`El archivo de ${label} no debe superar los 5MB.`);
  }

  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    throw new Error(`El archivo de ${label} debe ser PDF, JPG o PNG.`);
  }

  return file;
}

/** Registro presencial completo: datos del negocio, contacto y documentos. */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();

    const read = (key: string) => String(formData.get(key) || "").trim();

    const ruc = read("ruc");
    const legalName = read("legalName");
    const fiscalAddress = read("fiscalAddress");
    const representativeName = read("representativeName");
    const representativeDni = read("representativeDni");
    const representativeRole = read("representativeRole");
    const activityType = read("activityType");
    const email = read("email").toLowerCase();
    const phone = read("phone");

    if (!/^\d{11}$/.test(ruc)) {
      return NextResponse.json(
        { error: "El RUC debe tener 11 dígitos." },
        { status: 400 }
      );
    }

    if (legalName.length < 3) {
      return NextResponse.json(
        { error: "La razón social es obligatoria." },
        { status: 400 }
      );
    }

    if (fiscalAddress.length < 5) {
      return NextResponse.json(
        { error: "El domicilio fiscal es obligatorio." },
        { status: 400 }
      );
    }

    if (representativeName.length < 3) {
      return NextResponse.json(
        { error: "El nombre del representante legal es obligatorio." },
        { status: 400 }
      );
    }

    // SUNAT no informa el giro: lo declara el contribuyente en ventanilla.
    if (activityType.length < 3) {
      return NextResponse.json(
        { error: "El rubro o giro del negocio es obligatorio." },
        { status: 400 }
      );
    }

    if (!/^\d{8}$/.test(representativeDni)) {
      return NextResponse.json(
        { error: "El DNI del representante legal debe tener 8 dígitos." },
        { status: 400 }
      );
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json(
        { error: "Ingresa un correo electrónico válido." },
        { status: 400 }
      );
    }

    if (!/^\d{9}$/.test(phone)) {
      return NextResponse.json(
        { error: "El teléfono debe tener exactamente 9 dígitos." },
        { status: 400 }
      );
    }

    // Regla territorial: el cajero no puede saltearse el filtro de distrito.
    // Sale del caché de RUC, así que normalmente no gasta cuota de APIPERU.
    const rucData = await RucService.getBusinessData(ruc);


    // El RUC debe estar activo ante SUNAT: uno dado de baja, suspendido o
    // inhabilitado no puede obtener licencia de funcionamiento.
    const elegibilidad = checkRucEligibility(rucData);

    if (!elegibilidad.elegible) {
      return NextResponse.json(
        {
          error: elegibilidad.motivo,
          estadoTributario: rucData.estado,
          condicion: rucData.condicion,
        },
        { status: 400 }
      );
    }

    if (!belongsToDistrictTrujillo(rucData)) {
      return NextResponse.json(
        {
          error: OUT_OF_DISTRICT_MESSAGE,
          details: {
            distrito: rucData.distrito || "No registrado",
            provincia: rucData.provincia || "No registrado",
            departamento: rucData.departamento || "No registrado",
          },
        },
        { status: 400 }
      );
    }

    // Un RUC con trámite en curso o licencia vigente no puede abrir otro,
    // igual que en el flujo público. Se valida acá y no solo en la pantalla.
    const tramiteExistente =
      await ApplicationService.findBlockingApplicationByRuc(ruc);

    if (tramiteExistente) {
      return NextResponse.json(
        {
          error:
            tramiteExistente.motivo === "EN_PROCESO"
              ? `El RUC ${ruc} ya tiene el trámite ${tramiteExistente.number} en proceso. No corresponde registrar otro hasta que finalice.`
              : `El RUC ${ruc} ya cuenta con una licencia vigente (trámite ${tramiteExistente.number}).`,
          tramiteExistente,
        },
        { status: 409 }
      );
    }

    let planoFile: File;
    let certificadoFile: File;

    try {
      planoFile = validateFile(formData.get("plano"), "el plano del local");
      certificadoFile = validateFile(formData.get("certificados"), "los certificados");
    } catch (fileError: any) {
      return NextResponse.json({ error: fileError.message }, { status: 400 });
    }

    // 1. Alta del negocio, el solicitante y el trámite (queda en DRAFT).
    const { application, business } =
      await ApplicationService.registerInPersonApplication({
        cashierId: user.id,
        legalName,
        ruc,
        fiscalAddress,
        representativeName,
        representativeDni,
        representativeRole,
        activityType,
        email,
        phone,
      });

    // 2. Documentos. Se escriben directo con el repositorio, sin pasar por
    //    DocumentService.uploadDocument: ese hace un findById pesado (negocio,
    //    pagos, inspecciones, licencia) por cada archivo, y acá no hace falta
    //    —el trámite recién se creó en DRAFT y la carga siempre está permitida
    //    en ese estado—. Buffers y escrituras van en paralelo.
    const [planoBuffer, certificadoBuffer] = await Promise.all([
      planoFile.arrayBuffer(),
      certificadoFile.arrayBuffer(),
    ]);

    await Promise.all([
      DocumentRepository.create({
        applicationId: application.id,
        type: DocumentType.FLOOR_PLAN,
        name: "Plano del local",
        fileName: planoFile.name,
        mimeType: planoFile.type,
        size: planoFile.size,
        content: Buffer.from(planoBuffer),
      }),
      DocumentRepository.create({
        applicationId: application.id,
        type: DocumentType.RUC_RECORD,
        name: "Certificados",
        fileName: certificadoFile.name,
        mimeType: certificadoFile.type,
        size: certificadoFile.size,
        content: Buffer.from(certificadoBuffer),
      }),
    ]);

    // El trámite tiene los dos documentos obligatorios: queda listo para el
    // cobro. Es la transición que DocumentService haría sola en el flujo normal.
    await ApplicationRepository.updateStatus(
      application.id,
      ApplicationStatus.PENDING_PAYMENT
    );

    const updated = await ApplicationRepository.findById(application.id);

    return NextResponse.json(
      {
        success: true,
        message:
          "Solicitud presencial registrada. Queda pendiente el cobro para agendar la inspección.",
        application: {
          id: application.id,
          number: application.number,
          status: updated?.status ?? application.status,
          createdAt: application.createdAt,
        },
        business: { legalName: business.legalName, ruc: business.ruc },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error en registro presencial:", error);

    return NextResponse.json(
      { error: error?.message || "Error interno al registrar la solicitud." },
      { status: 400 }
    );
  }
}
