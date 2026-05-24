import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { PaymentSchema } from "@/lib/validation/payment";
import { PaymentService } from "@/services/payment.service";
import { ApplicationRepository } from "@/repositories/application.repository";

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
    const parsed = PaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos para el pago.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const application = await ApplicationRepository.findById(parsed.data.applicationId);
    if (!application || application.applicantId !== user.id) {
      return NextResponse.json({ error: "No se encontró el trámite asociado." }, { status: 404 });
    }

    if (application.status === "PAYMENT_COMPLETED") {
      return NextResponse.json({ error: "El trámite ya aparece como pagado." }, { status: 400 });
    }

    const payment = await PaymentService.simulatePayment(parsed.data.applicationId);

    return NextResponse.json({ success: true, payment });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Error interno al procesar el pago." }, { status: 500 });
  }
}
