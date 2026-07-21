import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { AdminService } from "@/services/admin.service";

export const dynamic = "force-dynamic";

/** Perfil detallado de un miembro del personal. */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const profile = await AdminService.getProfile(params.id);

  if (!profile) {
    return NextResponse.json(
      { error: "Usuario no encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json({ profile });
}

/** Cambio de contraseña o activación/desactivación. */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (typeof body.password === "string") {
      await AdminService.resetPassword({
        adminId: user.id,
        userId: params.id,
        newPassword: body.password,
      });

      return NextResponse.json({
        success: true,
        message: "Contraseña actualizada.",
      });
    }

    if (typeof body.active === "boolean") {
      await AdminService.setActive({
        adminId: user.id,
        userId: params.id,
        active: body.active,
      });

      return NextResponse.json({
        success: true,
        message: body.active ? "Cuenta activada." : "Cuenta desactivada.",
      });
    }

    return NextResponse.json(
      { error: "Nada para actualizar. Envía password o active." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error al actualizar el usuario." },
      { status: 400 }
    );
  }
}

/** Elimina la cuenta si no tiene historial asociado. */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (params.id === user.id) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta." },
      { status: 400 }
    );
  }

  try {
    await AdminService.deleteStaff({ adminId: user.id, userId: params.id });

    return NextResponse.json({ success: true, message: "Usuario eliminado." });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error al eliminar el usuario." },
      { status: 400 }
    );
  }
}
