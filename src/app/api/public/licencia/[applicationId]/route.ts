import { ApplicationRepository } from "@/repositories/application.repository";
import { LicenseService } from "@/services/license.service";
import { addExpiredWatermark } from "@/lib/pdf";
import { LicenseStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Descarga pública del PDF de la licencia.
 *
 * Sin sesión a propósito: el titular del flujo público y el del presencial no
 * pueden iniciar sesión (su passwordHash es un literal inutilizable), así que
 * la ruta autenticada les es inalcanzable y quedaban sin forma de obtener su
 * propia licencia.
 *
 * Que el contenido sea público lo confirmó el profesor, y se sostiene solo: el
 * negocio está obligado a exhibir la licencia en el local a la vista de
 * cualquiera, así que es difícil sostener que sea reservada, y la consulta
 * pública ya muestra razón social, RUC, dirección y número de licencia.
 *
 * **Esa obligación NO sale de la Ley 28976**, como decía antes este comentario.
 * Su art. 16 solo obliga a la *municipalidad* a exhibir el plano de
 * zonificación, el índice de usos y la estructura de costos. La del negocio
 * viene de la Ley Orgánica de Municipalidades (27972) y de las ordenanzas de
 * cada municipalidad.
 */
export async function GET(
  _request: Request,
  { params }: { params: { applicationId: string } }
) {
  // Refresca vencimiento/renovación antes de leer, para que la marca de agua
  // se decida sobre el estado real y no sobre uno viejo.
  await LicenseService.ensureRenewalState(params.applicationId);

  const application = await ApplicationRepository.findById(params.applicationId);

  if (!application || !application.license) {
    return new Response(
      JSON.stringify({ error: "No se encontró la licencia para este trámite." }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const license = application.license;

  // La marca de agua se aplica al vuelo, sobre una copia. El PDF guardado
  // queda intacto: si la licencia se renueva, vuelve a descargarse limpia.
  //
  // Una licencia dada de baja se sigue pudiendo descargar —es el respaldo de
  // que existió y de hasta cuándo valió—, pero marcada, para que no se pueda
  // exhibir como si estuviera en vigor.
  const marca =
    license.status === LicenseStatus.EXPIRED
      ? "VENCIDA"
      : license.status === LicenseStatus.CANCELLED
        ? "DADA DE BAJA"
        : null;

  const pdfBytes = marca
    ? await addExpiredWatermark(license.pdfContent, marca)
    : new Uint8Array(license.pdfContent);

  const fileName = marca
    ? license.pdfFileName.replace(
        /\.pdf$/i,
        `-${marca.replaceAll(" ", "-")}.pdf`
      )
    : license.pdfFileName;

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
