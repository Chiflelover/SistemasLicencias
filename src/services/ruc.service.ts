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

export class RucService {
  private static API_URL = "https://apiperu.dev/api/ruc";
  private static TOKEN = process.env.APIPERU_TOKEN;

  static async getBusinessData(ruc: string) {
    if (!ruc || !/^\d{11}$/.test(ruc)) {
      throw new Error("El RUC debe tener 11 dígitos.");
    }

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
}
