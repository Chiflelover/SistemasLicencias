import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { isAssemblingExpedient } from "@/lib/documents";

export const dynamic = "force-dynamic";

/**
 * Trámite a medio armar de ese RUC, para retomarlo en la ventanilla.
 *
 * El caso: el ciudadano empezó por la web, subió lo que pudo y se quedó sin
 * conexión. Viene al mostrador y el cajero necesita ver **lo que ya declaró**
 * —rubro, DNI, correo, archivos— para revisarlo con él y corregir lo que esté
 * mal, en vez de tipear todo de nuevo o abrir un trámite duplicado.
 *
 * No sale por `/api/ruc/[ruc]`, que es público y sin sesión: acá se devuelven
 * el correo y el DNI del contribuyente, que no son datos de la empresa.
 *
 * Solo los estados de armado del expediente. Un trámite ya pagado, observado o
 * con licencia no se "retoma": tiene sus propias pantallas.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ruc = (new URL(request.url).searchParams.get("ruc") || "").trim();

  if (!/^\d{11}$/.test(ruc)) {
    return NextResponse.json(
      { error: "El RUC debe tener 11 dígitos." },
      { status: 400 }
    );
  }

  try {
    const application = await prisma.application.findFirst({
      where: { business: { ruc } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        status: true,
        contactEmail: true,
        registeredById: true,
        // El local de ESTE trámite. Va en el trámite, no en Business (que es
        // compartido entre los locales del RUC).
        establishmentAddress: true,
        business: {
          select: {
            legalName: true,
            fiscalAddress: true,
            commercialAddress: true,
            activityType: true,
            representativeName: true,
            representativeDni: true,
            representativeRole: true,
          },
        },
        documents: {
          select: { id: true, type: true, name: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!application || !isAssemblingExpedient(application.status)) {
      return NextResponse.json({ tramite: null });
    }

    // El relleno que guardan los dos puntos de alta cuando el dato no se
    // relevó. Se devuelve vacío para que el formulario no lo muestre como si
    // el contribuyente lo hubiera declarado.
    const sinRelleno = (valor: string | null) =>
      !valor || valor === "No registrado" ? "" : valor;

    return NextResponse.json({
      tramite: {
        id: application.id,
        number: application.number,
        status: application.status,
        contactEmail: application.contactEmail || "",
        // De dónde vino: cambia el texto que ve el cajero.
        origen: application.registeredById ? "VENTANILLA" : "WEB",
        // El local de este trámite, si no es el domicilio fiscal: así la tarjeta
        // lo muestra ya seleccionado al retomar. Se lee del trámite, no de
        // Business (que es compartido entre los locales del RUC).
        commercialAddress:
          application.establishmentAddress &&
          application.establishmentAddress !== application.business.fiscalAddress
            ? application.establishmentAddress
            : "",
        activityType: sinRelleno(application.business.activityType),
        representativeName: sinRelleno(application.business.representativeName),
        representativeDni: sinRelleno(application.business.representativeDni),
        representativeRole:
          application.business.representativeRole || "Representante Legal",
        documents: application.documents,
      },
    });
  } catch (error: any) {
    console.error("Error buscando el trámite en curso:", error);

    return NextResponse.json(
      { error: error?.message || "Error interno al consultar el trámite." },
      { status: 500 }
    );
  }
}
