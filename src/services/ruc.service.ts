import { prisma } from "@/lib/db/prisma";
import { isValidRuc } from "@/lib/ruc";

interface ApiPeruRucData {
  ruc?: string;
  nombre_o_razon_social?: string;
  razon_social?: string;
  direccion?: string;
  direccion_completa?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  estado?: string;
  condicion?: string;
  ubigeo?: string;
  es_agente_retencion?: string;
  es_agente_percepcion?: string;
  es_agente_percepcion_combustible?: string;
  es_buen_contribuyente?: string;
}

interface ApiPeruRucResponse {
  success: boolean;
  data?: ApiPeruRucData;
  message?: string;
  error?: string;
}

export interface RucBusinessData {
  ruc: string;
  legalName: string;
  fiscalAddress: string;
  departamento: string;
  provincia: string;
  distrito: string;
  estado: string;
  condicion: string;
  ubigeo: string;
  es_agente_retencion: string;
  es_agente_percepcion: string;
  es_agente_percepcion_combustible: string;
  es_buen_contribuyente: string;
}

export class RucService {
  private static API_URL = "https://apiperu.dev/api/ruc";
  private static TOKEN = process.env.APIPERU_TOKEN;

  /** Días que una consulta cacheada se considera vigente. */
  private static CACHE_TTL_DAYS = 30;

  /**
   * Devuelve los datos del RUC, reutilizando el caché cuando sigue vigente.
   *
   * Iniciar un trámite consulta el mismo RUC dos veces (la vista previa del
   * formulario y la revalidación al crear el trámite); el caché evita gastar
   * dos veces la cuota de APIPERU por cada trámite.
   */
  static async getBusinessData(ruc: string) {
    if (!ruc || !/^\d{11}$/.test(ruc)) {
      throw new Error("El RUC debe tener 11 dígitos.");
    }

    // El dígito de control se calcula localmente: un RUC mal tipeado no
    // llega a consumir cuota de APIPERU.
    if (!isValidRuc(ruc)) {
      throw new Error(
        "El RUC ingresado no es válido. Verificá los dígitos, especialmente el último."
      );
    }

    const cached = await this.readFromCache(ruc);
    if (cached) {
      return cached;
    }

    const data = await this.fetchFromApi(ruc);
    await this.writeToCache(ruc, data);

    return data;
  }

  private static async fetchFromApi(ruc: string) {
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
      body: JSON.stringify({ ruc }),
      cache: "no-store",
    });

    const text = await response.text();

    let result: ApiPeruRucResponse;

    try {
      result = JSON.parse(text);
    } catch {
      console.error("APIPERU devolvió algo que no es JSON:", text);
      throw new Error("APIPERU no devolvió JSON. Revisa el endpoint o el token.");
    }

    if (!response.ok) {
      throw new Error(
        result.message ||
          result.error ||
          "No se pudo consultar la información del RUC."
      );
    }

    if (!result.success || !result.data) {
      throw new Error(
        result.message ||
          result.error ||
          "No se encontró información para el RUC proporcionado."
      );
    }

    const legalName =
      result.data.nombre_o_razon_social ||
      result.data.razon_social ||
      "Razón social no encontrada";

    const fiscalAddress =
      result.data.direccion_completa ||
      [
        result.data.direccion,
        result.data.distrito,
        result.data.provincia,
        result.data.departamento,
      ]
        .filter(Boolean)
        .join(", ") ||
      "Dirección no encontrada";

    return {
      ruc: result.data.ruc || ruc,
      legalName,
      fiscalAddress,
      departamento: result.data.departamento || "",
      provincia: result.data.provincia || "",
      distrito: result.data.distrito || "",
      estado: result.data.estado || "No registrado",
      condicion: result.data.condicion || "No registrado",
      ubigeo: result.data.ubigeo || "",
      es_agente_retencion: result.data.es_agente_retencion || "NO",
      es_agente_percepcion: result.data.es_agente_percepcion || "NO",
      es_agente_percepcion_combustible:
        result.data.es_agente_percepcion_combustible || "NO",
      es_buen_contribuyente: result.data.es_buen_contribuyente || "NO",
    };
  }

  private static async readFromCache(ruc: string): Promise<RucBusinessData | null> {
    try {
      const cached = await prisma.rucCache.findUnique({ where: { ruc } });
      if (!cached) {
        return null;
      }

      // Se compara contra la fecha real y no contra la simulada del DevPanel:
      // el vencimiento depende de la API externa, no del reloj del sistema.
      const ageInDays =
        (Date.now() - cached.fetchedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (ageInDays > this.CACHE_TTL_DAYS) {
        return null;
      }

      return cached.payload as unknown as RucBusinessData;
    } catch {
      // El caché es una optimización: si falla, se consulta la API igual.
      return null;
    }
  }

  private static async writeToCache(ruc: string, data: RucBusinessData) {
    try {
      await prisma.rucCache.upsert({
        where: { ruc },
        update: { payload: data as any, fetchedAt: new Date() },
        create: { ruc, payload: data as any, fetchedAt: new Date() },
      });
    } catch {
      // Si no se puede guardar, el trámite continúa sin caché.
    }
  }
}
