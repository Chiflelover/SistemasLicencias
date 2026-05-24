import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApplicationService } from "@/services/application.service";
import { BusinessSchema } from "@/lib/validation/business";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    if (user.role !== "APPLICANT") {
      return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
    }

    const body = await request.json();
    const parsed = BusinessSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos para el registro del negocio.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { application, business } = await ApplicationService.startNewApplication({
      applicantId: user.id,
      legalName: parsed.data.legalName,
      ruc: parsed.data.ruc,
      fiscalAddress: parsed.data.fiscalAddress,
      commercialAddress: parsed.data.commercialAddress,
      activityType: parsed.data.activityType,
      representativeName: parsed.data.representativeName,
    });

    return NextResponse.json({ success: true, application, business });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error interno al registrar el negocio." },
      { status: 400 }
    );
  }
}
