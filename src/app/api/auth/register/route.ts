import { NextResponse } from "next/server";
import { AuthService } from "../../../../services/auth.service";
import { z } from "zod";

const RegisterSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  fullName: z.string().min(3, "El nombre completo debe tener al menos 3 caracteres"),
  dni: z.string().length(8, "El DNI debe tener exactamente 8 dígitos").regex(/^\d+$/, "El DNI debe contener solo números"),
  phone: z.string().min(9, "El teléfono debe tener al menos 9 dígitos").regex(/^\+?\d+$/, "El número de teléfono no es válido"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validar esquema
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { 
          error: "Datos de registro inválidos", 
          details: parsed.error.flatten().fieldErrors 
        },
        { status: 400 }
      );
    }

    const { email, password, fullName, dni, phone } = parsed.data;

    // Registrar al solicitante
    const result = await AuthService.registerApplicant({
      email,
      passwordPlain: password,
      fullName,
      dni,
      phone,
    });

    return NextResponse.json({
      success: true,
      message: "Registro exitoso",
      user: result.user,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error interno del servidor durante el registro." },
      { status: 400 }
    );
  }
}
