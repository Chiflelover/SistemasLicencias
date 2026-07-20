import { prisma } from "@/lib/db/prisma";

interface ApiPeruDniData {
  numero?: string;
  nombre_completo?: string;
  nombres?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
}

interface ApiPeruDniResponse {
  success: boolean;
  data?: ApiPeruDniData;
  message?: string;
  error?: string;
}

export interface DniPersonData {
  dni: string;
  fullName: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

/**
 * Consulta de DNI en RENIEC a través de APIPERU.
 *
 * Sirve para autocompletar el nombre del representante legal en ventanilla,
 * evitando errores de tipeo en un dato que después figura en la licencia.
 */
export class DniService {
  private static API_URL = "https://apiperu.dev/api/dni";
  private static TOKEN = process.env.APIPERU_TOKEN;

  /** Días que una consulta cacheada se considera vigente. */
  private static CACHE_TTL_DAYS = 30;

  static async getPersonData(dni: string): Promise<DniPersonData> {
    if (!dni || !/^\d{8}$/.test(dni)) {
      throw new Error("El DNI debe tener 8 dígitos.");
    }

    const cached = await this.readFromCache(dni);
    if (cached) {
      return cached;
    }

    const data = await this.fetchFromApi(dni);
    await this.writeToCache(dni, data);

    return data;
  }

  private static async fetchFromApi(dni: string): Promise<DniPersonData> {
    if (!this.TOKEN) {
      throw new Error("No se encontró APIPERU_TOKEN en las variables de entorno.");
    }

    const response = await fetch(this.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.TOKEN}`,
        Accept: "application/json",
      },
      body: JSON.stringify({ dni }),
      cache: "no-store",
    });

    const text = await response.text();

    let result: ApiPeruDniResponse;

    try {
      result = JSON.parse(text);
    } catch {
      throw new Error("APIPERU no devolvió JSON al consultar el DNI.");
    }

    if (!response.ok || !result.success || !result.data) {
      throw new Error(
        result.message || result.error || "No se encontró información para ese DNI."
      );
    }

    const nombres = result.data.nombres || "";
    const paterno = result.data.apellido_paterno || "";
    const materno = result.data.apellido_materno || "";

    // Se arma "Nombres Apellidos", que es como se firma un trámite, en lugar
    // del "Apellidos, Nombres" que devuelve RENIEC.
    const fullName =
      [nombres, paterno, materno].filter(Boolean).join(" ").trim() ||
      result.data.nombre_completo ||
      "";

    return {
      dni: result.data.numero || dni,
      fullName,
      nombres,
      apellidoPaterno: paterno,
      apellidoMaterno: materno,
    };
  }

  private static async readFromCache(dni: string): Promise<DniPersonData | null> {
    try {
      const cached = await prisma.dniCache.findUnique({ where: { dni } });
      if (!cached) {
        return null;
      }

      // Fecha real y no simulada: el vencimiento depende de la API externa.
      const ageInDays =
        (Date.now() - cached.fetchedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (ageInDays > this.CACHE_TTL_DAYS) {
        return null;
      }

      return cached.payload as unknown as DniPersonData;
    } catch {
      return null;
    }
  }

  private static async writeToCache(dni: string, data: DniPersonData) {
    try {
      await prisma.dniCache.upsert({
        where: { dni },
        update: { payload: data as any, fetchedAt: new Date() },
        create: { dni, payload: data as any, fetchedAt: new Date() },
      });
    } catch {
      // El caché es una optimización: si falla, la consulta ya se resolvió.
    }
  }
}
