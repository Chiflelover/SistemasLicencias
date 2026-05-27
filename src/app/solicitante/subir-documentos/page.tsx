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

      {application?.documents?.length ? (
        <div className="rounded-3xl border border-slate-850 bg-slate-950/50 p-6 text-slate-200">
          <p className="text-sm text-amber-300 font-semibold mb-3">Documentos ya subidos</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {application.documents.map((document: any) => (
              <div key={document.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{document.type.replaceAll("_", " ")}</p>
                <p className="mt-2 text-sm text-slate-300">{document.name}</p>
                <p className="mt-1 text-xs text-slate-500">{document.fileName}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <UploadDocumentForm applicationId={application?.id ?? null} />
    </div>
  );
}
