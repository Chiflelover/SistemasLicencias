import { getCurrentUser } from "@/lib/auth";
import { ApplicationRepository } from "@/repositories/application.repository";
import { LicenseService } from "@/services/license.service";

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

  return new Response(new Uint8Array(application.license.pdfContent), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${application.license.pdfFileName}"`,
    },
  });
}
