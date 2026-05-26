export interface ApiPeruRucResponse {
  success?: boolean;
  data?: {
    ruc?: string;
    nombre_o_razon_social?: string;
    razon_social?: string;
    direccion?: string;
    direccion_completa?: string;
    estado?: string;
    condicion?: string;
  };
  message?: string;
}

export class RucService {
  private static API_URL = "https://apiperu.dev/api/ruc";

  static async getBusinessData(ruc: string) {
    if (!/^\d{11}$/.test(ruc)) {
      throw new Error("El RUC debe tener exactamente 11 dígitos numéricos.");
    }

    const token = process.env.APIPERU_TOKEN;

    if (!token) {
      throw new Error("Falta configurar APIPERU_TOKEN en el archivo .env.");
    }

    const response = await fetch(this.API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
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

    console.log("APIPERU STATUS:", response.status);
    console.log("APIPERU RESPONSE:", result);

    if (!response.ok) {
      throw new Error(
        result.message || `APIPERU respondió con error ${response.status}.`
      );
    }

    if (!result.success || !result.data) {
      throw new Error(
        result.message || "No se encontró información para el RUC ingresado."
      );
    }

    const legalName =
      result.data.nombre_o_razon_social || result.data.razon_social || "";

    const fiscalAddress =
      result.data.direccion_completa || result.data.direccion || "";

    if (!legalName) {
      throw new Error("APIPERU no devolvió la razón social del RUC.");
    }

    if (!fiscalAddress) {
      throw new Error("APIPERU no devolvió el domicilio fiscal del RUC.");
    }

    return {
      ruc: result.data.ruc || ruc,
      legalName,
      fiscalAddress,
      estado: result.data.estado || "",
      condicion: result.data.condicion || "",
    };
  }
}