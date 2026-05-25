export interface RucResponse {
  success: boolean;
  data?: {
    nombre_o_razon_social: string;
    direccion_completa: string;
    ruc: string;
    estado: string;
    condicion: string;
  };
  message?: string;
}

export class RucService {
  private static API_URL = "https://apiperu.dev/api/v1/ruc";
  private static TOKEN = process.env.APIPERU_TOKEN;

  static async getBusinessData(ruc: string) {
    // Validación de longitud
    if (ruc.length !== 11 || !/^\d+$/.test(ruc)) {
      throw new Error("El RUC debe tener exactamente 11 dígitos numéricos.");
    }

    if (!this.TOKEN) {
      throw new Error("Configuración del servidor incompleta (API Token faltante).");
    }

    try {
      const url = `${this.API_URL}/${ruc}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.TOKEN}`,
          "Accept": "application/json",
        },
        // Evitar caché para asegurar datos frescos de la SUNAT
        cache: 'no-store'
      });

      const result: RucResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.message || "No se encontró información para el RUC proporcionado.");
      }

      return {
        legalName: result.data.nombre_o_razon_social,
        fiscalAddress: result.data.direccion_completa,
      };
    } catch (error) {
      throw error;
    }
  }
}