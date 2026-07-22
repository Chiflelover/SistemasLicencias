import { getCurrentUser } from "../../lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, Navbar, AperturaCajaModal } from "../../components";

export const dynamic = "force-dynamic";

export default async function CajeroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "CAJERO") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Tapa el área entera mientras la caja no esté abierta. Va en el layout
          para cubrir las cinco pantallas con un solo montaje. */}
      <AperturaCajaModal />

      <Sidebar role="CAJERO" userName={user.fullName} />

      <div className="flex-grow flex flex-col lg:pl-64 min-h-screen">
        <Navbar userName={user.fullName} email={user.email} role="CAJERO" />

        <main className="flex-grow p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
