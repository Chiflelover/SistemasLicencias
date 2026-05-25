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
  private static API_URL = "https://apiperu.dev/api/ruc";
  private static TOKEN = process.env.APIPERU_TOKEN;

  static async getBusinessData(ruc: string) {
    // 1. Validación de longitud
    if (ruc.length !== 11 || !/^\d+$/.test(ruc)) {
      throw new Error("El RUC debe tener exactamente 11 dígitos numéricos.");
    }

    if (!this.TOKEN) {
      throw new Error("Configuración del servidor incompleta (API Token faltante).");
    }

    try {
      const response = await fetch(`${this.API_URL}/${ruc}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.TOKEN}`,
        },
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