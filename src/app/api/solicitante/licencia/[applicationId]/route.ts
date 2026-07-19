import { getCurrentUser } from "@/lib/auth";
import { ApplicationRepository } from "@/repositories/application.repository";
import { LicenseService } from "@/services/license.service";
import { addExpiredWatermark } from "@/lib/pdf";
import { LicenseStatus } from "@prisma/client";

export async function GET(
  _request: Request,
  { params }: { params: { applicationId: string } }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "APPLICANT") {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  await LicenseService.ensureRenewalState(params.applicationId);

  const application = await ApplicationRepository.findById(params.applicationId);
  if (!application || application.applicantId !== user.id) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  if (!application.license) {
    return new Response(JSON.stringify({ error: "No se encontró la licencia para este trámite." }), { status: 404, headers: { "Content-Type": "application/json" } });
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
