import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { NotificationService } from "@/services/notification.service";
import { LicenseService } from "@/services/license.service";

export const dynamic = "force-dynamic";

/**
 * Notificaciones del usuario autenticado.
 *
 * Antes de listar recalcula los avisos que dependen del día (agenda de hoy,
 * licencias vencidas), porque el sistema no tiene tareas programadas.
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Vence las licencias que corresponda antes de calcular los avisos.
  await LicenseService.syncExpiredLicenses();

  await NotificationService.syncDailyNotifications(user.id, user.role);

  const { items, unreadCount } = await NotificationService.list(user.id);

  return NextResponse.json({ notifications: items, unreadCount });
}

/** Marca todas como leídas. */
export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const updated = await NotificationService.markAllAsRead(user.id);

  return NextResponse.json({ success: true, updated });
}
