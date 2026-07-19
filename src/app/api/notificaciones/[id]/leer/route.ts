import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { NotificationService } from "@/services/notification.service";

export const dynamic = "force-dynamic";

/** Marca una notificación como leída. Solo las propias. */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const updated = await NotificationService.markAsRead(user.id, params.id);

  if (!updated) {
    return NextResponse.json(
      { error: "No se encontró la notificación." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
