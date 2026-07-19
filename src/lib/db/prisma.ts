import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

/**
 * Modelos que el registro de simulación NO anota.
 *
 * Los propios del simulador (para no entrar en recursión) y el reloj, que es
 * la herramienta y no un dato del negocio.
 */
const MODELOS_IGNORADOS = new Set([
  "SimulationRun",
  "SimulationChange",
  "SystemConfig",
  "RucCache",
]);

const OPERACIONES_DE_ESCRITURA = new Set([
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]);

function mapearOperacion(action: string): "CREATE" | "UPDATE" | "DELETE" {
  if (action.startsWith("create")) return "CREATE";
  if (action.startsWith("delete")) return "DELETE";
  return "UPDATE";
}

/** Convierte valores no serializables (Bytes, Decimal, Date) a JSON. */
function serializar(valor: unknown): unknown {
  if (valor === null || valor === undefined) return valor;
  if (valor instanceof Date) return valor.toISOString();
  if (Buffer.isBuffer(valor)) return `<binario ${valor.length} bytes>`;
  if (Array.isArray(valor)) return valor.map(serializar);

  if (typeof valor === "object") {
    // Decimal de Prisma y similares exponen toString().
    if (valor.constructor?.name === "Decimal") return String(valor);

    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      salida[k] = serializar(v);
    }
    return salida;
  }

  return valor;
}

/**
 * Anota en SimulationChange cada escritura que ocurre mientras hay una
 * simulación de tiempo en curso.
 *
 * Se hace con un middleware para no tener que instrumentar cada servicio: si
 * mañana se agrega una funcionalidad nueva, queda registrada sola.
 */
if (!globalForPrisma.prisma) {
  prisma.$use(async (params, next) => {
    const model = params.model;
    const esEscritura = OPERACIONES_DE_ESCRITURA.has(params.action);

    if (!model || !esEscritura || MODELOS_IGNORADOS.has(model)) {
      return next(params);
    }

    // Estado previo, para poder deshacer el cambio al restablecer.
    let before: unknown = null;

    if (params.action !== "create" && params.action !== "createMany") {
      try {
        const where = (params.args as { where?: unknown })?.where;
        if (where) {
          before = await (prisma as any)[
            model.charAt(0).toLowerCase() + model.slice(1)
          ].findMany({ where });
        }
      } catch {
        // Si no se puede leer el estado previo, el cambio igual se anota.
      }
    }

    const resultado = await next(params);

    try {
      const corrida = await prisma.simulationRun.findFirst({
        where: { status: "RUNNING" },
        select: { id: true },
      });

      if (!corrida) {
        return resultado;
      }

      const registro = resultado as { id?: string } | null;

      // Un upsert que no encontró fila previa es en realidad una creación.
      // Sin esta corrección, al revertir se intentaría restaurar un estado
      // anterior que no existe y la fila quedaría huérfana.
      let operation = mapearOperacion(params.action);
      const previos = Array.isArray(before) ? before : [];

      if (operation === "UPDATE" && previos.length === 0 && registro?.id) {
        operation = "CREATE";
      }

      await prisma.simulationChange.create({
        data: {
          runId: corrida.id,
          model,
          operation,
          recordId: registro?.id ?? null,
          before: (serializar(before) ?? undefined) as any,
          after: (serializar(resultado) ?? undefined) as any,
          description: `${params.action} en ${model}`,
        },
      });
    } catch (error) {
      // Anotar nunca debe romper la operación de negocio.
      console.error("No se pudo registrar el cambio de simulación:", error);
    }

    return resultado;
  });
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
