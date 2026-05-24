import { NextResponse } from "next/server";
import { BusinessService } from "@/services/business.service";
import { BusinessSchema } from "@/lib/validation/business";

export async function POST(request: Request) {
  try {
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

    const business = await BusinessService.registerBusiness(parsed.data);

    return NextResponse.json({ success: true, business });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error interno al registrar el negocio." },
      { status: 400 }
    );
  }
}
