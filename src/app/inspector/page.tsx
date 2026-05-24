import { getCurrentUser } from "../../lib/auth";
import { redirect } from "next/navigation";
import { InspectorPanel } from "@/components/InspectorPanel";

export const dynamic = "force-dynamic";

export default async function InspectorDashboard() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "INSPECTOR") {
    redirect("/login");
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-850">
        <div>
          <h1 className="text-2xl font-bold text-white">¡Buenas tardes, {user.fullName}!</h1>
          <p className="text-slate-400 text-sm mt-1">
            Estas son las inspecciones programadas que tienes asignadas. Revisa cada trámite y registra tu decisión.
          </p>
        </div>
      </div>

      <InspectorPanel />
    </div>
  );
}
