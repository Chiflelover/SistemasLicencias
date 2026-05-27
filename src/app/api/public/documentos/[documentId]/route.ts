import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { documentId: string } }
) {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: params.documentId },
    });

    if (!doc) {
      return new Response("Documento no encontrado", { status: 404 });
    }

    return new Response(new Uint8Array(doc.content), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `inline; filename="${doc.fileName}"`,
      },
    });
  } catch (error) {
    return new Response("Error al obtener el documento", { status: 500 });
  }
}
