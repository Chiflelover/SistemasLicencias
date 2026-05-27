import Link from "next/link";
import {
  Shield,
  ArrowRight,
  ClipboardCheck,
  Sparkles,
  SearchCheck,
} from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      <header className="border-b border-slate-800 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              T
            </div>

            <div>
              <span className="font-bold text-white tracking-wide block">
                MUNICIPALIDAD DE TRUJILLO
              </span>
              <span className="text-slate-500 text-xs uppercase font-medium">
                Ciudad de la Primavera
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition duration-150"
            >
              Iniciar Sesión
            </Link>

            <Link
              href="/iniciar-tramite"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition duration-150"
            >
              Iniciar trámite
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <section className="flex-grow max-w-7xl mx-auto px-6 py-12 md:py-20 flex flex-col lg:flex-row items-center justify-between gap-12">
        <div className="space-y-6 lg:w-1/2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium">
            <Sparkles className="w-4 h-4 animate-pulse" />
            Plataforma Digital de Trámites 2026
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-none">
            Licencias Municipales de{" "}
            <span className="text-amber-400">Funcionamiento</span>
          </h1>

          <p className="text-slate-400 text-lg leading-relaxed max-w-lg">
            Solicita, tramita y obtén la licencia comercial de funcionamiento
            para tu establecimiento en Trujillo de forma 100% digital, rápida y
            transparente.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <Link
              href="/iniciar-tramite"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-8 py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 transition duration-200 transform hover:scale-[1.02]"
            >
              Iniciar Nuevo Trámite
              <ArrowRight className="w-5 h-5" />
            </Link>

            <Link
              href="/consulta"
              prefetch={false}
              className="bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-semibold px-8 py-3 rounded-lg flex items-center justify-center gap-2 transition duration-150"
            >
              Consulta Pública
            </Link>
          </div>
        </div>

        <div className="lg:w-1/2 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-900/50 border border-slate-850 p-6 rounded-2xl space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
              <Shield className="w-5 h-5" />
            </div>

            <h3 className="font-bold text-white text-lg">100% Seguro</h3>

            <p className="text-slate-400 text-sm">
              Tus datos personales y de negocio están protegidos con
              autenticación segura y cifrado.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-850 p-6 rounded-2xl space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
              <SearchCheck className="w-5 h-5" />
            </div>

            <h3 className="font-bold text-white text-lg">
              Validación por RUC
            </h3>

            <p className="text-slate-400 text-sm">
              Inicia el trámite ingresando el RUC. El sistema valida que el
              domicilio fiscal pertenezca al distrito de Trujillo.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-850 p-6 rounded-2xl space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
              <ClipboardCheck className="w-5 h-5" />
            </div>

            <h3 className="font-bold text-white text-lg">
              Requisitos Simples
            </h3>

            <p className="text-slate-400 text-sm">
              Solo necesitas el RUC de 11 dígitos, planos del establecimiento
              en PDF/imagen y realizar el pago del trámite.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-850 p-6 rounded-2xl space-y-3">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <h3 className="font-bold text-white text-lg">
                  Costo del Trámite
                </h3>

                <p className="text-slate-400 text-sm">
                  De acuerdo con el Texto Único de Procedimientos
                  Administrativos vigente.
                </p>
              </div>

              <span className="text-3xl font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl">
                S/ 180.00
              </span>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-900 bg-slate-950 py-8 text-center text-slate-500 text-sm">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p>
            © {new Date().getFullYear()} Municipalidad Provincial de Trujillo.
            Todos los derechos reservados.
          </p>

          <div className="flex gap-4 text-xs">
            <span className="hover:text-slate-300 transition cursor-help">
              Términos
            </span>
            <span className="hover:text-slate-300 transition cursor-help">
              Privacidad
            </span>
            <span className="hover:text-slate-300 transition cursor-help">
              Soporte TUPA
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}