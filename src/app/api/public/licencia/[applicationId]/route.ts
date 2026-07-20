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
 * propia licencia. La licencia de funcionamiento además es un documento
 * público —la Ley 28976 obliga a exhibirla en el local— y la consulta pública
 * ya muestra razón social, RUC, dirección y número de licencia.
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
  const pdfBytes =
    license.status === LicenseStatus.EXPIRED
      ? await addExpiredWatermark(license.pdfContent)
      : new Uint8Array(license.pdfContent);

  const fileName =
    license.status === LicenseStatus.EXPIRED
      ? license.pdfFileName.replace(/\.pdf$/i, "-VENCIDA.pdf")
      : license.pdfFileName;

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
