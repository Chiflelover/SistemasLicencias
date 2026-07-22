"use client";

import { FormEvent, useEffect, useState } from "react";

interface LicenseOption {
  id: string;
  licenseNumber: string;
  status: string;
  issuedAt: string;
  expiresAt: string;
  application: {
    id: string;
    number: string;
    business: {
      legalName: string;
      ruc: string;
    };
  };
}

export default function InspectorInopinadasPage() {
  const [licenses, setLicenses] = useState<LicenseOption[]>([]);
  const [selectedLicenseId, setSelectedLicenseId] = useState<string>("");

  // Viaja la gravedad, no el monto: el importe sale de la UIT vigente y la
  // calcula el servidor. Ver src/lib/uit.ts.
  const [gravedad, setGravedad] = useState<string>("");
  const [gravedades, setGravedades] = useState<
    Array<{ clave: string; nombre: string; porcentaje: number; monto: number }>
  >([]);
  const [description, setDescription] = useState("");
  const [observations, setObservations] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLicenses = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/inspector/inopinadas");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "No se pudieron cargar las licencias.");
        }
        setLicenses(data.licenses || []);
        if (data.licenses?.length > 0) {
          setSelectedLicenseId(data.licenses[0].id);
        }
      } catch (error) {
        setErrorMessage((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchLicenses();

    fetch("/api/uit", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setGravedades(data.gravedades || []))
      .catch(() => {
        // Sin la escala no se dibujan los botones; el error del servidor
        // avisa igual si se intenta registrar sin gravedad.
      });
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);
    setLoading(true);

    try {
      const response = await fetch("/api/inspector/inopinadas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseId: selectedLicenseId,
          gravedad,
          description,
          observations,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo registrar la inspección inopinada.");
      }

      setSuccessMessage("Registro inopinado guardado correctamente.");
      setDescription("");
      setObservations("");
      setGravedad("");
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6">
        <h1 className="text-2xl font-bold text-white">Inspecciones Inopinadas</h1>
        <p className="text-slate-400 mt-2">
          Registra observaciones y multas sin bloquear el trámite. Solo guarda la información.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_0.7fr]">
        <section className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 space-y-6">
          {successMessage && (
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-semibold">Licencia asociada</span>
                <select
                  value={selectedLicenseId}
                  onChange={(event) => setSelectedLicenseId(event.target.value)}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-amber-500"
                >
                  {licenses.map((license) => (
                    <option key={license.id} value={license.id}>
                      {license.licenseNumber} — {license.application.business.legalName}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2 text-sm text-slate-300">
                <span className="font-semibold">Gravedad de la infracción</span>

                {/* Cuatro tramos y no un monto libre: las multas municipales
                    se expresan en porcentaje de UIT. El monto lo calcula el
                    servidor con la UIT vigente. */}
                <div className="grid grid-cols-2 gap-2">
                  {gravedades.map((g) => {
                    const activo = gravedad === g.clave;

                    return (
                      <button
                        key={g.clave}
                        type="button"
                        onClick={() => setGravedad(g.clave)}
                        className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                          activo
                            ? "border-amber-400 bg-amber-500/10"
                            : "border-slate-800 bg-slate-950/80 hover:border-slate-600"
                        }`}
                      >
                        <span
                          className={`block text-sm font-bold ${
                            activo ? "text-amber-300" : "text-slate-200"
                          }`}
                        >
                          {g.nombre}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          {g.porcentaje}% UIT · S/{" "}
                          {g.monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <label className="space-y-2 text-sm text-slate-300">
              <span className="font-semibold">Descripción de la falta</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-[120px] w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-amber-500"
                placeholder="Describe lo observado durante la inspección inopinada..."
                required
              />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span className="font-semibold">Observaciones adicionales</span>
              <textarea
                value={observations}
                onChange={(event) => setObservations(event.target.value)}
                className="min-h-[100px] w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-amber-500"
                placeholder="Anota información extra que deba quedar registrada..."
              />
            </label>

            <button
              type="submit"
              disabled={loading || !selectedLicenseId}
              className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Registrando..." : "Registrar inspección inopinada"}
            </button>
          </form>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-850 bg-slate-900/40 p-6">
            <h2 className="text-lg font-bold text-white">Licencias disponibles</h2>
            <p className="text-slate-400 mt-2 text-sm">
              Selecciona una licencia activa o en renovación para asociar la inspección inopinada.
            </p>
            <div className="mt-5 space-y-4">
              {licenses.length === 0 ? (
                <div className="rounded-2xl border border-slate-850 bg-slate-950/50 p-4 text-slate-400">
                  No hay licencias disponibles para inspecciones inopinadas.
                </div>
              ) : (
                licenses.map((license) => (
                  <div key={license.id} className="rounded-2xl border border-slate-850 bg-slate-950/40 p-4">
                    <p className="text-sm font-semibold text-white">{license.licenseNumber}</p>
                    <p className="text-slate-400 text-xs mt-1">{license.application.business.legalName}</p>
                    <p className="text-slate-400 text-xs mt-1">Vence: {new Date(license.expiresAt).toLocaleDateString("es-PE")}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
