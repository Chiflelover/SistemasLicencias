import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { prisma } from "@/lib/db/prisma";
import { ApplicationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAYMENT_AMOUNT = 2;

function getAccessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (
    !token ||
    token.includes("AQUI_PEGA") ||
    token.includes("PEGA_AQUI") ||
    token.includes("ACCESS_TOKEN_REAL")
  ) {
    throw new Error(
      "El Access Token de Mercado Pago no está configurado correctamente en .env."
    );
  }

  return token;
}

function buildValidPayerEmail(ruc: string) {
  const cleanRuc = ruc.replace(/\D/g, "");
  return `tramite${cleanRuc}@gmail.com`;
}

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
        business: true,
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

    const body = await request.json();

    if (!body.token) {
      return NextResponse.json(
        { error: "Mercado Pago no envió el token de la tarjeta." },
        { status: 400 }
      );
    }

    if (!body.payment_method_id) {
      return NextResponse.json(
        { error: "Mercado Pago no envió el método de pago." },
        { status: 400 }
      );
    }

    const accessToken = getAccessToken();

    const client = new MercadoPagoConfig({
      accessToken,
    });

    const paymentClient = new Payment(client);

    const payerEmail = buildValidPayerEmail(application.business.ruc);

    const paymentBody: any = {
      transaction_amount: PAYMENT_AMOUNT,
      token: body.token,
      description: `Pago trámite municipal ${application.number}`,
      installments: Number(body.installments || 1),
      payment_method_id: body.payment_method_id,
      payer: {
        email: payerEmail,
        identification: {
          type: body.payer?.identification?.type || "DNI",
          number: body.payer?.identification?.number || "75708992",
        },
      },
    };

    if (body.issuer_id) {
      paymentBody.issuer_id = String(body.issuer_id);
    }

    const payment = await paymentClient.create({
      body: paymentBody,
    });

    if (payment.status !== "approved") {
      return NextResponse.json(
        {
          error:
            payment.status_detail ||
            "El pago no fue aprobado por Mercado Pago.",
          paymentStatus: payment.status,
          paymentStatusDetail: payment.status_detail,
        },
        { status: 400 }
      );
    }

    const updatedApplication = await prisma.application.update({
      where: {
        id: application.id,
      },
      data: {
        status: ApplicationStatus.PAYMENT_COMPLETED,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Pago aprobado correctamente.",
      paymentId: payment.id,
      paymentStatus: payment.status,
      payerEmail,
      application: updatedApplication,
    });
  } catch (error: any) {
    console.error("Error procesando pago público:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Error interno al procesar el pago con Mercado Pago.",
      },
      { status: 500 }
    );
  }
}