import { NextResponse } from "next/server";
import { ApplicationService } from "@/services/application.service";
import { RucService } from "@/services/ruc.service";
import { belongsToDistrictTrujillo } from "@/lib/territory";
import { checkRucEligibility } from "@/lib/ruc-eligibility";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ruc = String(body.ruc || "").trim();

    if (!/^\d{11}$/.test(ruc)) {
      return NextResponse.json(
        { error: "El RUC debe tener 11 dígitos." },
        { status: 400 }
      );
    }

    // El rubro no lo devuelve SUNAT: lo declara el ciudadano. Sin él la
    // licencia se emitiría con "No registrado" en el giro comercial.
    const activityType = String(body.activityType || "").trim();

    // Para volverlo OPCIONAL, usar esta condición en lugar de la de abajo.
    // Solo valida el largo cuando mandaron algo:
    //
    //   if (activityType.length > 0 && activityType.length < 3) {
    //
    // Sin rubro, el negocio se guarda con "No registrado" y eso mismo se
    // imprime en la licencia como giro comercial.
    if (activityType.length < 3) {
      return NextResponse.json(
        { error: "Indica el rubro o giro del negocio (mínimo 3 caracteres)." },
        { status: 400 }
      );
    }

    // Correo de contacto: es la única vía para avisarle al ciudadano, que no
    // puede iniciar sesión. Se valida acá y no solo en el navegador.
    const contactEmail = String(body.contactEmail || "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json(
        { error: "Indica un correo de contacto válido." },
        { status: 400 }
      );
    }

    // DNI del representante legal: se declara, no se verifica. La consulta a
    // RENIEC exige sesión y el flujo público no la tiene, así que solo se
    // valida el formato. Sirve para identificar al titular en la licencia,
    // que si no salía impresa con el usuario sintético del trámite.
    const representativeDni = String(body.representativeDni || "").trim();

    // Para volverlo OPCIONAL, usar esta condición en lugar de la de abajo.
    // Solo valida el formato cuando mandaron algo:
    //
    //   if (representativeDni && !/^\d{8}$/.test(representativeDni)) {
    //
    // Sin DNI, el negocio se guarda con la cadena vacía y la licencia imprime
    // "No registrado" en el representante, como antes de que se pidiera.
    if (!/^\d{8}$/.test(representativeDni)) {
      return NextResponse.json(
        { error: "El DNI del representante legal debe tener 8 dígitos." },
        { status: 400 }
      );
    }

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
          error:
            "No se puede iniciar el trámite. Este sistema solo atiende establecimientos con domicilio fiscal en el distrito de Trujillo, provincia de Trujillo, departamento de La Libertad.",
          details: {
            distrito: rucData.distrito || "No registrado",
            provincia: rucData.provincia || "No registrado",
            departamento: rucData.departamento || "No registrado",
          },
        },
        { status: 400 }
      );
    }

    // No se permite abrir un segundo trámite para el mismo RUC mientras haya
    // uno en curso o una licencia vigente. Se valida acá y no solo en la
    // pantalla, para que no dependa del navegador.
    const tramiteExistente =
      await ApplicationService.findBlockingApplicationByRuc(rucData.ruc);

    if (tramiteExistente) {
      return NextResponse.json(
        {
          error:
            tramiteExistente.motivo === "EN_PROCESO"
              ? `El RUC ${rucData.ruc} ya tiene el trámite ${tramiteExistente.number} en proceso. No puedes iniciar otro hasta que finalice.`
              : `El RUC ${rucData.ruc} ya cuenta con una licencia vigente (trámite ${tramiteExistente.number}). No corresponde iniciar un trámite nuevo.`,
          tramiteExistente,
        },
        { status: 409 }
      );
    }

    const { application, business } =
      await ApplicationService.startPublicApplication({
        ruc: rucData.ruc,
        legalName: rucData.legalName,
        fiscalAddress: rucData.fiscalAddress,
        activityType,
        contactEmail,
        representativeDni,
      });

    return NextResponse.json(
      {
        success: true,
        message: "Trámite público iniciado correctamente.",
        application,
        business,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error en trámite público:", error);

    return NextResponse.json(
      {
        error:
          error?.message || "Error interno al iniciar el trámite público.",
      },
      { status: 400 }
    );
  }
}