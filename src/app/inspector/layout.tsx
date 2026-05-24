import { getCurrentUser } from "../../lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, Navbar, DevPanel } from "../../components";

export const dynamic = "force-dynamic";

export default async function InspectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "INSPECTOR") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar de Navegación Lateral (Fijo a la izquierda) */}
      <Sidebar role="INSPECTOR" userName={user.fullName} />

      {/* Contenedor del Contenido Principal */}
      <div className="flex-grow flex flex-col lg:pl-64 min-h-screen">
        {/* Navbar Superior */}
        <Navbar userName={user.fullName} email={user.email} role="INSPECTOR" />

        {/* Zona de Renderizado de Páginas */}
        <main className="flex-grow p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Panel Flotante DEV para Simular Tiempo */}
      <DevPanel />
    </div>
  );
}
