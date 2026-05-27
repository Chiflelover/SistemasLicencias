"use client";

import { FormEvent, useState } from "react";

type SearchResult = {
  id: string;
  business: {
    legalName: string;
    commercialAddress: string | null;
    activityType: string | null;
  };
  license: {
    status: string;
  } | null;
};

function formatStatus(status: string) {
  switch (status) {
    case "ACTIVE":
      return "Activa";
    case "RENEWAL_AVAILABLE":
      return "Renovación disponible";
    case "EXPIRED":
      return "Vencida";
    default:
      return status;
  }
}

export default function PublicLicenseSearch() {
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanQuery = query.trim();

    setErrorMessage(null);
    setResults([]);
    setSearchedQuery(cleanQuery);

    if (cleanQuery.length < 3) {
      setErrorMessage("Ingresa al menos 3 caracteres para buscar.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/public/consulta?q=${encodeURIComponent(cleanQuery)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo realizar la consulta.");
      }

      setResults(data.results || []);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSearch} className="grid gap-4">
        <label className="block">
          <span className="text-sm font-semibold text-slate-200">
            RUC o razón social
          </span>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="text"
            placeholder="Ej. 12345678901 o COMERCIAL ABC S.A."
            className="mt-3 w-full rounded-3xl border border-slate-800 bg-slate-900/80 px-4 py-4 text-slate-100 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-3xl bg-amber-500 px-5 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {errorMessage && (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          {errorMessage}
        </div>
      )}

      {searchedQuery && !loading && !errorMessage && (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-400">Resultados para:</p>
            <p className="text-lg font-semibold text-white">{searchedQuery}</p>
          </div>

          {results.length === 0 ? (
            <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
              No se encontraron búsquedas con ese RUC o razón social.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/80 shadow-lg shadow-slate-950/20">
              <table className="min-w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/90 text-xs uppercase tracking-[0.18em] text-slate-400">
                  <tr>
                    <th className="px-4 py-4">Razón social</th>
                    <th className="px-4 py-4">Dirección</th>
                    <th className="px-4 py-4">Rubro</th>
                    <th className="px-4 py-4">Estado licencia</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {results.map((application) => (
                    <tr key={application.id} className="hover:bg-slate-900/60">
                      <td className="px-4 py-4 text-white">
                        {application.business.legalName}
                      </td>

                      <td className="px-4 py-4 text-slate-300">
                        {application.business.commercialAddress ||
                          "No registrada"}
                      </td>

                      <td className="px-4 py-4 text-slate-300">
                        {application.business.activityType || "No especificado"}
                      </td>

                      <td className="px-4 py-4 text-amber-300">
                        {formatStatus(application.license?.status || "-")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}