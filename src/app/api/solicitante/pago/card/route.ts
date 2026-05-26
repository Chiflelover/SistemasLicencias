import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { getCurrentUser } from "@/lib/auth";
import { ApplicationRepository } from "@/repositories/application.repository";
import { PaymentService } from "@/services/payment.service";
import { ApplicationStatus } from "@prisma/client";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado. Inicia sesión nuevamente." },
        { status: 401 }
      );
    }

    if (user.role !== "APPLICANT") {
      return NextResponse.json(
        { error: "Acceso restringido. Solo el solicitante puede pagar." },
        { status: 403 }
      );
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json(
        {
          error:
            "Falta configurar MERCADOPAGO_ACCESS_TOKEN en el archivo .env.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const applicationId = body.applicationId;

    if (!applicationId) {
      return NextResponse.json(
        { error: "Falta el ID del trámite." },
        { status: 400 }
      );
    }

    const application = await ApplicationRepository.findById(applicationId);

    if (!application) {
      return NextResponse.json(
        { error: "Trámite no encontrado." },
        { status: 404 }
      );
    }

    if (application.applicantId !== user.id) {
      return NextResponse.json(
        { error: "No puedes pagar un trámite que no te pertenece." },
        { status: 403 }
      );
    }

    if (
      application.status !== ApplicationStatus.PENDING_PAYMENT &&
      application.status !== ApplicationStatus.RENEWAL_AVAILABLE
    ) {
      return NextResponse.json(
        {
          error:
            "Este trámite no está pendiente de pago o renovación. No se puede cobrar nuevamente.",
        },
        { status: 400 }
      );
    }

    const amount = Number(body.transaction_amount);

    if (amount !== 2) {
      return NextResponse.json(
        { error: "El monto del pago debe ser exactamente S/ 2.00." },
        { status: 400 }
      );
    }

    if (!body.token) {
      return NextResponse.json(
        { error: "Falta el token de la tarjeta generado por Mercado Pago." },
        { status: 400 }
      );
    }

    if (!body.payment_method_id) {
      return NextResponse.json(
        { error: "Falta el método de pago de Mercado Pago." },
        { status: 400 }
      );
    }

    const paymentClient = new Payment(client);

    const mercadoPagoPayment = await paymentClient.create({
      body: {
        transaction_amount: 2,
        token: body.token,
        description: `Derecho de trámite - ${application.number}`,
        installments: Number(body.installments || 1),
        payment_method_id: body.payment_method_id,
        issuer_id: body.issuer_id,
        payer: {
          email: body.payer?.email || user.email,
          identification: body.payer?.identification,
        },
        metadata: {
          applicationId: application.id,
          applicationNumber: application.number,
          applicantId: user.id,
        },
      },
      requestOptions: {
        idempotencyKey: randomUUID(),
      },
    });

    if (mercadoPagoPayment.status !== "approved") {
      return NextResponse.json(
        {
          error: `El pago no fue aprobado. Estado recibido: ${mercadoPagoPayment.status}`,
          mercadoPagoStatus: mercadoPagoPayment.status,
          mercadoPagoDetail: mercadoPagoPayment.status_detail,
        },
        { status: 400 }
      );
    }

    const payment = await PaymentService.simulatePayment(application.id);

    return NextResponse.json({
      success: true,
      message: "Pago aprobado y registrado correctamente.",
      payment,
      mercadoPago: {
        id: mercadoPagoPayment.id,
        status: mercadoPagoPayment.status,
        statusDetail: mercadoPagoPayment.status_detail,
        amount: mercadoPagoPayment.transaction_amount,
      },
    });
  } catch (error: any) {
    console.error("Error procesando pago con tarjeta:", error);

    return NextResponse.json(
      {
        error:
          error?.message || "Error interno al procesar el pago con tarjeta.",
      },
      { status: 500 }
    );
  }
}