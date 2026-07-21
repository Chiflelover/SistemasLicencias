"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Building2, 
  FileText, 
  CalendarDays, 
  Award, 
  FolderSearch, 
  ShieldAlert, 
  DollarSign,
  LayoutDashboard,
  Users,
  Menu,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  FileUp
} from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  // Solo el personal: el administrado no tiene cuenta ni área autenticada.
  role: "INSPECTOR" | "CAJERO" | "ADMIN" | "DEVELOPER";
  userName: string;
}

export default function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Arranca desplegado si el inspector entró directo a una página secundaria,
  // para que se vea cuál está activa y no parezca que la sección no existe.
  const [mostrarSecundarios, setMostrarSecundarios] = useState(
    pathname.startsWith("/inspector/")
  );

  const inspectorLinks = [
    {
      label: "Bandeja de Tareas",
      href: "/inspector",
      icon: LayoutDashboard,
    },
    {
      label: "Inspecciones Inopinadas",
      href: "/inspector/inopinadas",
      icon: ShieldAlert,
      secondary: true,
    },
    {
      label: "Multas Registradas",
      href: "/inspector/multas",
      icon: DollarSign,
      secondary: true,
    },
  ];

  const cajeroLinks = [
    {
      label: "Vista General",
      href: "/cajero",
      icon: LayoutDashboard,
    },
    {
      label: "Registro Presencial",
      href: "/cajero/registro-presencial",
      icon: Building2,
    },
    {
      label: "Registrar Pago",
      href: "/cajero/pago",
      icon: DollarSign,
    },
    {
      label: "Arqueo de Caja",
      href: "/cajero/arqueo",
      icon: FolderSearch,
    },
    {
      label: "Renovación de Licencia",
      href: "/cajero/renovacion",
      icon: RefreshCw,
    },
    {
      label: "Subsanar Documentos",
      href: "/cajero/subsanar",
      icon: FileUp,
    },
  ];

  const adminLinks = [
    {
      label: "Vista General",
      href: "/admin",
      icon: LayoutDashboard,
    },
    {
      label: "Personal",
      href: "/admin/usuarios",
      icon: Users,
    },
    {
      label: "Recaudación por Caja",
      href: "/admin/cajas",
      icon: DollarSign,
    },
  ];

  const developerLinks = [
    {
      label: "Simulaciones",
      href: "/dev",
      icon: LayoutDashboard,
    },
  ];

  const linksByRole = {
    INSPECTOR: inspectorLinks,
    CAJERO: cajeroLinks,
    ADMIN: adminLinks,
    DEVELOPER: developerLinks,
  };

  const links = linksByRole[role] ?? [];

  // Los secundarios existen pero se muestran solo al desplegarlos con el ojo.
  const principales = links.filter(
    (link) => !("secondary" in link && link.secondary)
  );
  const secundarios = links.filter(
    (link) => "secondary" in link && link.secondary
  );

  const toggleSidebar = () => setIsOpen(!isOpen);

  const renderLink = (link: (typeof links)[number]) => {
    const isActive = pathname === link.href;
    const Icon = link.icon;

    return (
      <Link
        key={link.label}
        href={link.href}
        onClick={() => setIsOpen(false)}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition duration-200 ${
          isActive
            ? "bg-amber-500 text-slate-950"
            : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
        }`}
      >
        <Icon className={`w-4 h-4 ${isActive ? "text-slate-950" : "text-slate-400"}`} />
        {link.label}
      </Link>
    );
  };

  return (
    <>
      {/* Botón de Menú Móvil */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 border border-slate-800 text-slate-100 rounded-lg hover:bg-slate-800"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar Overlay (Móviles) */}
      {isOpen && (
        <div
          onClick={toggleSidebar}
          className="lg:hidden fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm"
        />
      )}

      {/* Contenedor del Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-850 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header Branding */}
        <div className="p-6 border-b border-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              MPT
            </div>
            <div>
              <span className="font-bold text-white tracking-wide text-sm block">TRUJILLO DIGITAL</span>
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                {role === "INSPECTOR"
                  ? "Portal Inspector"
                  : role === "CAJERO"
                  ? "Portal Cajero"
                  : role === "ADMIN"
                  ? "Portal Administrador"
                  : role === "DEVELOPER"
                  ? "Portal Desarrollo"
                  : "Portal Solicitante"}
              </span>
            </div>
          </div>
        </div>

        {/* Links de Navegación */}
        <nav className="flex-grow p-4 overflow-y-auto flex flex-col">
          <div className="space-y-1.5">{principales.map(renderLink)}</div>

          {secundarios.length > 0 && (
            // mt-auto empuja este bloque al fondo del nav, contra la línea del
            // perfil. Va en un div propio y no en el botón, porque un space-y
            // en el contenedor pisaría el mt-auto de un hijo directo.
            <div className="mt-auto space-y-1.5">
              {mostrarSecundarios && (
                <div className="space-y-1.5 border-l border-slate-800 ml-4 pl-2">
                  {secundarios.map(renderLink)}
                </div>
              )}

              {/* Los secundarios se guardan detrás de este ojo para no saturar
                  el menú, pero siguen accesibles al desplegarlos. */}
              <button
                type="button"
                onClick={() => setMostrarSecundarios((v) => !v)}
                title={
                  mostrarSecundarios ? "Ocultar más opciones" : "Más opciones"
                }
                aria-label={
                  mostrarSecundarios ? "Ocultar más opciones" : "Más opciones"
                }
                className="flex items-center justify-center px-4 py-2.5 rounded-lg text-slate-900 hover:bg-slate-800/60 hover:text-slate-400 transition duration-200"
              >
                {mostrarSecundarios ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
        </nav>

        {/* Perfil del Usuario al Fondo */}
        <div className="p-4 border-t border-slate-850 bg-slate-950/40">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/50 border border-slate-850">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-xs uppercase">
              {userName.substring(0, 2)}
            </div>
            <div className="min-w-0 flex-grow">
              <p className="text-xs font-semibold text-slate-200 truncate">{userName}</p>
              <p className="text-[10px] text-slate-500 truncate">
                {role === "INSPECTOR"
                  ? "Inspector MPT"
                  : role === "CAJERO"
                  ? "Cajero MPT"
                  : role === "ADMIN"
                  ? "Administrador"
                  : role === "DEVELOPER"
                  ? "Desarrollador"
                  : "Solicitante"}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
