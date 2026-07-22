import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * Cuántos avisos sin leer tiene el usuario. Nada más.
 *
 * Existe para que la campana pueda preguntar cada 20 segundos sin costo: el
 * endpoint completo (`/api/notificaciones`) vence licencias y recalcula los
 * avisos del día antes de responder, y correr eso tres veces por minuto sería
 * caro y ruidoso. Acá va una sola cuenta contra un índice.
 *
 * Cuando el número cambia, la campana pide la lista completa por el otro
 * endpoint: los recálculos siguen ocurriendo, pero solo cuando hay algo nuevo.
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });

  return NextResponse.json({ unreadCount });
}
