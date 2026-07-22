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

/**
 * SUNAT devuelve el tipo con su código adelante: "SU. SUCURSAL",
 * "AL. ALMACEN", "OF. OFICINA ADMINISTRATIVA". Se le saca el código y se deja
 * en capitular, que es lo que va a leer el ciudadano.
 */
function limpiarTipoEstablecimiento(valor: unknown): string {
  const texto = String(valor || "").trim();
  if (!texto) return "Establecimiento anexo";

  const sinCodigo = texto.replace(/^[A-Z]{2}\.\s*/, "");

  return sinCodigo.charAt(0) + sinCodigo.slice(1).toLowerCase();
}

/** Un local declarado en SUNAT además del domicilio fiscal. */
export interface RucEstablishment {
  codigo: string;
  tipo: string;
  actividad: string;
  direccion: string;
  distrito: string;
  provincia: string;
  departamento: string;
}

export class RucService {
  private static API_URL = "https://apiperu.dev/api/ruc";
  private static ANEXOS_URL = "https://apiperu.dev/api/ruc-establecimientos-anexos";
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
        "El RUC ingresado no es válido. Verifica los dígitos, especialmente el último."
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

  /**
   * Locales anexos declarados en SUNAT, además del domicilio fiscal.
   *
   * Es información **solo visual**: no entra en ninguna regla de elegibilidad
   * ni frena un trámite. Por eso nunca lanza — si la API falla, si el plan no
   * tiene acceso al endpoint o si el token venció, devuelve lista vacía y la
   * tarjeta simplemente no se dibuja. Una caída de un dato decorativo no puede
   * tumbar el inicio de un trámite.
   *
   * Consume cuota aparte de `/api/ruc`, así que va con su propio caché de 30
   * días: sin eso, cada RUC costaría dos consultas en vez de una.
   */
  static async getEstablishments(ruc: string): Promise<RucEstablishment[]> {
    if (!/^\d{11}$/.test(ruc) || !isValidRuc(ruc)) {
      return [];
    }

    const cached = await this.readAnexosFromCache(ruc);
    if (cached) {
      return cached;
    }

    if (!this.TOKEN) {
      return [];
    }

    try {
      const response = await fetch(this.ANEXOS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.TOKEN}`,
          Accept: "application/json",
        },
        body: JSON.stringify({ ruc }),
        cache: "no-store",
      });

      const result = await response.json();

      // PLAN_DENIED cuando el plan no cubre el endpoint. No es un error del
      // sistema y no tiene por qué verse en pantalla: se anota y se sigue.
      if (!response.ok || !result?.success || !Array.isArray(result.data)) {
        console.error(
          "APIPERU no devolvió establecimientos anexos:",
          result?.code || response.status,
          result?.message || ""
        );
        return [];
      }

      const anexos: RucEstablishment[] = result.data.map((item: any) => ({
        codigo: String(item?.codigo || ""),
        tipo: limpiarTipoEstablecimiento(item?.tipo_de_establecimiento),
        // SUNAT la devuelve vacía en la mayoría de los casos.
        actividad: String(item?.actividad_economica || "").trim(),
        direccion: String(item?.direccion_completa || item?.direccion || "").trim(),
        distrito: String(item?.distrito || "").trim(),
        provincia: String(item?.provincia || "").trim(),
        departamento: String(item?.departamento || "").trim(),
      }));

      await this.writeAnexosToCache(ruc, anexos);

      return anexos;
    } catch (error) {
      console.error("No se pudieron consultar los establecimientos anexos:", error);
      return [];
    }
  }

  private static async readAnexosFromCache(
    ruc: string
  ): Promise<RucEstablishment[] | null> {
    try {
      const cached = await prisma.rucAnexosCache.findUnique({ where: { ruc } });
      if (!cached) {
        return null;
      }

      // Fecha real, no la simulada del DevPanel: el vencimiento depende de la
      // API externa y no del reloj del trámite.
      const ageInDays =
        (Date.now() - cached.fetchedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (ageInDays > this.CACHE_TTL_DAYS) {
        return null;
      }

      return cached.payload as unknown as RucEstablishment[];
    } catch {
      return null;
    }
  }

  private static async writeAnexosToCache(
    ruc: string,
    anexos: RucEstablishment[]
  ) {
    try {
      await prisma.rucAnexosCache.upsert({
        where: { ruc },
        update: { payload: anexos as any, fetchedAt: new Date() },
        create: { ruc, payload: anexos as any, fetchedAt: new Date() },
      });
    } catch {
      // Sin caché la consulta se repite: cuesta cuota, no rompe nada.
    }
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
