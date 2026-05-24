import { NextResponse } from "next/server";
import { advanceSystemDateByDays, advanceSystemDateByYears, getCurrentSystemDate } from "@/lib/date";

export async function GET() {
  const current = await getCurrentSystemDate();
  return NextResponse.json({ currentSystemDate: current.toISOString() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { unit, amount } = body as { unit?: string; amount?: number };
  if (!unit || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "Se requiere unit y amount válidos." }, { status: 400 });
  }

  try {
    let newDate: Date;
    if (unit === "days") {
      newDate = await advanceSystemDateByDays(amount);
    } else if (unit === "years") {
      newDate = await advanceSystemDateByYears(amount);
    } else {
      return NextResponse.json({ error: "Unidad no soportada." }, { status: 400 });
    }

    return NextResponse.json({ currentSystemDate: newDate.toISOString() });
  } catch (error) {
    return NextResponse.json({ error: "No se pudo avanzar la fecha del sistema." }, { status: 500 });
  }
}
