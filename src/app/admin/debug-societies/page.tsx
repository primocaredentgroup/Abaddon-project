"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export default function DebugSocietiesPage() {
  const [email, setEmail] = useState("");
  const [debugEmail, setDebugEmail] = useState("");

  const debugData = useQuery(
    api.debugDomainSociety.debugAutoAssign,
    debugEmail ? { email: debugEmail } : "skip"
  );

  const forceAssign = useMutation(api.debugDomainSociety.forceAssign);

  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleDebug = () => {
    setDebugEmail(email);
    setResult(null);
    setError("");
  };

  const handleForceAssign = async () => {
    setError("");
    setResult(null);
    try {
      const res = await forceAssign({ email });
      setResult(res);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🔍 Debug Assegnazione Automatica Società</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Email</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="es. f.grinfone@primogroup.it"
              className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleDebug}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Analizza
            </button>
          </div>

          {debugData && (
            <div className="space-y-4">
              {debugData.error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                  <p className="text-red-700 font-semibold">❌ Errore: {debugData.error}</p>
                </div>
              )}

              {debugData.user && (
                <div className="p-4 bg-gray-50 rounded">
                  <h3 className="font-semibold mb-2">👤 Utente</h3>
                  <pre className="text-sm">{JSON.stringify(debugData.user, null, 2)}</pre>
                </div>
              )}

              {debugData.userSocieties && (
                <div className="p-4 bg-gray-50 rounded">
                  <h3 className="font-semibold mb-2">
                    🏢 Società Assegnate ({debugData.userSocieties.active} attive)
                  </h3>
                  {debugData.userSocieties.list.length > 0 ? (
                    <pre className="text-sm">
                      {JSON.stringify(debugData.userSocieties.list, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-gray-600 italic">Nessuna società assegnata</p>
                  )}
                </div>
              )}

              {debugData.mapping && (
                <div
                  className={`p-4 rounded ${
                    debugData.mapping.foundActive
                      ? "bg-green-50 border border-green-200"
                      : "bg-yellow-50 border border-yellow-200"
                  }`}
                >
                  <h3 className="font-semibold mb-2">
                    🗺️ Mapping per dominio "{debugData.domain}"
                  </h3>
                  {debugData.mapping.found ? (
                    <div>
                      <p className="mb-2">
                        <span className="font-medium">Stato:</span>{" "}
                        <span
                          className={
                            debugData.mapping.details.isActive
                              ? "text-green-600 font-semibold"
                              : "text-red-600 font-semibold"
                          }
                        >
                          {debugData.mapping.details.isActive ? "✅ Attivo" : "❌ Disattivo"}
                        </span>
                      </p>
                      <pre className="text-sm">
                        {JSON.stringify(debugData.mapping.details, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-yellow-700 font-semibold">
                      ⚠️ Nessun mapping trovato per questo dominio
                    </p>
                  )}
                </div>
              )}

              {debugData.society && (
                <div
                  className={`p-4 rounded ${
                    debugData.society.isActive
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <h3 className="font-semibold mb-2">🏛️ Società da Assegnare</h3>
                  <pre className="text-sm">{JSON.stringify(debugData.society, null, 2)}</pre>
                </div>
              )}

              <div
                className={`p-4 rounded border-2 ${
                  debugData.shouldAssign
                    ? "bg-green-50 border-green-400"
                    : "bg-red-50 border-red-400"
                }`}
              >
                <h3 className="font-semibold mb-2 text-lg">📋 Risultato Analisi</h3>
                <p className="mb-2">
                  <span className="font-medium">Dovrebbe assegnare?</span>{" "}
                  <span className={debugData.shouldAssign ? "text-green-600" : "text-red-600"}>
                    {debugData.shouldAssign ? "✅ SÌ" : "❌ NO"}
                  </span>
                </p>
                <p>
                  <span className="font-medium">Motivo:</span>{" "}
                  <span className="font-semibold">{debugData.reason}</span>
                </p>
              </div>

              {debugData.shouldAssign && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                  <h3 className="font-semibold mb-2">⚡ Azione</h3>
                  <p className="mb-3 text-sm text-gray-700">
                    Il sistema dovrebbe assegnare automaticamente la società. Puoi forzare
                    l'assegnazione manualmente ora:
                  </p>
                  <button
                    onClick={handleForceAssign}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    🚀 Forza Assegnazione
                  </button>
                </div>
              )}

              <details className="p-4 bg-gray-100 rounded">
                <summary className="font-semibold cursor-pointer">
                  📊 Tutti i Mapping (Debug)
                </summary>
                <pre className="text-xs mt-2">
                  {JSON.stringify(debugData.allMappings, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {result && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
              <h3 className="font-semibold text-green-800 mb-2">✅ Successo!</h3>
              <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
              <h3 className="font-semibold text-red-800 mb-2">❌ Errore</h3>
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Nota</h3>
          <p className="text-sm text-yellow-800">
            Questa è una pagina di debug temporanea. Inserisci l'email dell'utente per vedere tutti
            i dettagli dell'assegnazione automatica e capire perché non funziona.
          </p>
        </div>
      </div>
    </div>
  );
}

