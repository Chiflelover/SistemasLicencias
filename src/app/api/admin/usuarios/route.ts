import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { AdminService, isManageableRole } from "@/services/admin.service";

export const dynamic = "force-dynamic";

/** Lista el personal (inspectores y cajeros). */
export async function GET() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const staff = await AdminService.listStaff();

  return NextResponse.json({ staff });
}

/** Alta de un inspector o cajero. */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.fullName || "").trim();
    const dni = String(body.dni || "").trim();
    const phone = String(body.phone || "").trim();
    const role = String(body.role || "").trim().toUpperCase();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json(
        { error: "Ingresa un correo electrónico válido." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 400 }
      );
    }

    if (fullName.length < 3) {
      return NextResponse.json(
        { error: "El nombre completo es obligatorio." },
        { status: 400 }
      );
    }

    if (!/^\d{8}$/.test(dni)) {
      return NextResponse.json(
        { error: "El DNI debe tener 8 dígitos." },
        { status: 400 }
      );
    }

    if (!/^\d{9}$/.test(phone)) {
      return NextResponse.json(
        { error: "El teléfono debe tener exactamente 9 dígitos." },
        { status: 400 }
      );
    }

    if (!isManageableRole(role)) {
      return NextResponse.json(
        { error: "El rol debe ser INSPECTOR o CAJERO." },
        { status: 400 }
      );
    }

    const created = await AdminService.createStaff({
      adminId: user.id,
      email,
      password,
      fullName,
      dni,
      phone,
      role,
    });

    return NextResponse.json({ success: true, user: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error al crear el usuario." },
      { status: 400 }
    );
  }
}
