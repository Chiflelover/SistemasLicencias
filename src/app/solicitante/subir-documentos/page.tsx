import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ApplicationRepository } from "@/repositories/application.repository";
import UploadDocumentForm from "@/components/UploadDocumentForm";

export const dynamic = "force-dynamic";

export default async function SubirDocumentosPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "APPLICANT") {
    redirect("/login");
  }

  const application = await ApplicationRepository.findByApplicantId(user.id);

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/40 p-6 rounded-3xl border border-slate-850">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-amber-400 font-semibold mb-2">Gestión documental</p>
          <h1 className="text-3xl font-bold text-white">Subir documentos para tu trámite</h1>
          <p className="mt-2 text-slate-400 max-w-2xl">
            Adjunta los archivos requeridos para continuar con tu solicitud de licencia municipal.
          </p>
        </div>
      </div>

      <UploadDocumentForm applicationId={application?.id ?? null} />
    </div>
  );
}
