import { NextResponse } from "next/server";
import { AuthService } from "../../../../services/auth.service";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validar esquema
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos de inicio de sesión inválidos",
          details: parsed.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // Iniciar sesión
    const result = await AuthService.login({
      email,
      passwordPlain: password,
    });

    return NextResponse.json({
      success: true,
      message: "Inicio de sesión exitoso",
      user: result.user,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error interno del servidor durante el inicio de sesión." },
      { status: 400 }
    );
  }
}
