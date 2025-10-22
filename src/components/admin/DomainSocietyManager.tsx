"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { Trash2, Plus, Edit2, Check, X } from "lucide-react";

export default function DomainSocietyManager() {
  const mappings = useQuery(api.domainSocieties.list, {});
  const societies = useQuery(api.societies.getAllSocieties, { activeOnly: true });
  const createMapping = useMutation(api.domainSocieties.create);
  const updateMapping = useMutation(api.domainSocieties.update);
  const removeMapping = useMutation(api.domainSocieties.remove);
  const initDefaults = useMutation(api.domainSocieties.initDefaultMappings);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<Id<"domainSocieties"> | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [newSocietyId, setNewSocietyId] = useState<Id<"societies"> | "">("");
  const [editDomain, setEditDomain] = useState("");
  const [editSocietyId, setEditSocietyId] = useState<Id<"societies"> | "">("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleAdd = async () => {
    setError("");
    setSuccess("");

    if (!newDomain.trim()) {
      setError("Il dominio è obbligatorio");
      return;
    }

    if (!newSocietyId) {
      setError("Seleziona una società");
      return;
    }

    try {
      await createMapping({
        domain: newDomain.trim(),
        societyId: newSocietyId as Id<"societies">,
      });
      setSuccess("Mapping creato con successo!");
      setNewDomain("");
      setNewSocietyId("");
      setIsAdding(false);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Errore nella creazione del mapping");
    }
  };

  const handleUpdate = async (mappingId: Id<"domainSocieties">) => {
    setError("");
    setSuccess("");

    try {
      await updateMapping({
        mappingId,
        domain: editDomain.trim() || undefined,
        societyId: editSocietyId ? (editSocietyId as Id<"societies">) : undefined,
      });
      setSuccess("Mapping aggiornato con successo!");
      setEditingId(null);
      setEditDomain("");
      setEditSocietyId("");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Errore nell'aggiornamento del mapping");
    }
  };

  const handleDelete = async (mappingId: Id<"domainSocieties">) => {
    if (!confirm("Sei sicuro di voler eliminare questo mapping?")) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await removeMapping({ mappingId });
      setSuccess("Mapping eliminato con successo!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Errore nell'eliminazione del mapping");
    }
  };

  const handleToggleActive = async (mappingId: Id<"domainSocieties">, currentActive: boolean) => {
    setError("");
    setSuccess("");

    try {
      await updateMapping({
        mappingId,
        isActive: !currentActive,
      });
      setSuccess(`Mapping ${!currentActive ? "attivato" : "disattivato"} con successo!`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Errore nell'aggiornamento del mapping");
    }
  };

  const handleInitDefaults = async () => {
    if (!confirm("Vuoi inizializzare i mapping di default? (HQ, Cliniche, Laboratorio)")) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const result = await initDefaults({});
      
      let message = result.message;
      
      // Aggiungo dettagli sui mapping saltati
      if (result.skippedMappings && result.skippedMappings.length > 0) {
        message += `\n\nSaltati ${result.skippedMappings.length}: ${result.skippedMappings.map((s: any) => `${s.domain} (${s.reason})`).join(", ")}`;
      }
      
      // Mostro società disponibili
      if (result.availableSocieties && result.availableSocieties.length > 0) {
        message += `\n\nSocietà disponibili: ${result.availableSocieties.map((s: any) => `${s.name} (${s.code})`).join(", ")}`;
      }
      
      setSuccess(message);
      setTimeout(() => setSuccess(""), 8000);
    } catch (err: any) {
      setError(err.message || "Errore nell'inizializzazione dei mapping");
    }
  };

  const startEdit = (mapping: any) => {
    setEditingId(mapping._id);
    setEditDomain(mapping.domain);
    setEditSocietyId(mapping.societyId);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDomain("");
    setEditSocietyId("");
  };

  if (!mappings || !societies) {
    return <div className="p-4">Caricamento...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Gestione Assegnazione Automatica Società</h2>
          <p className="text-gray-600 mt-1">
            Configura le regole per assegnare automaticamente le società agli utenti in base al dominio email
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleInitDefaults}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            Inizializza Default
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            <Plus size={18} />
            Aggiungi Mapping
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
          <div className="whitespace-pre-line">{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded">
          <div className="whitespace-pre-line">{success}</div>
        </div>
      )}

      {/* Form Aggiungi Nuovo */}
      {isAdding && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded">
          <h3 className="font-semibold mb-3">Nuovo Mapping Dominio → Società</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Dominio Email (es. primogroup.it)
              </label>
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="primogroup.it"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Società</label>
              <select
                value={newSocietyId}
                onChange={(e) => setNewSocietyId(e.target.value as Id<"societies">)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleziona una società...</option>
                {societies.map((society) => (
                  <option key={society._id} value={society._id}>
                    {society.name} ({society.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Salva
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewDomain("");
                setNewSocietyId("");
                setError("");
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Tabella Mapping */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Dominio</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Società</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Stato</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Creato il</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {mappings.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Nessun mapping configurato. Clicca "Aggiungi Mapping" o "Inizializza Default" per iniziare.
                </td>
              </tr>
            ) : (
              mappings.map((mapping) => (
                <tr key={mapping._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {editingId === mapping._id ? (
                      <input
                        type="text"
                        value={editDomain}
                        onChange={(e) => setEditDomain(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    ) : (
                      <span className="font-mono text-sm">{mapping.domain}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === mapping._id ? (
                      <select
                        value={editSocietyId}
                        onChange={(e) => setEditSocietyId(e.target.value as Id<"societies">)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        {societies.map((society) => (
                          <option key={society._id} value={society._id}>
                            {society.name} ({society.code})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div>
                        <div className="font-medium">{mapping.society?.name}</div>
                        <div className="text-xs text-gray-500">{mapping.society?.code}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(mapping._id, mapping.isActive)}
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        mapping.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {mapping.isActive ? "Attivo" : "Disattivo"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(mapping.createdAt).toLocaleDateString("it-IT")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      {editingId === mapping._id ? (
                        <>
                          <button
                            onClick={() => handleUpdate(mapping._id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Salva"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                            title="Annulla"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(mapping)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Modifica"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(mapping._id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Elimina"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Come funziona</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Quando un utente fa login per la prima volta, il sistema estrae il dominio dalla sua email</li>
          <li>• Se trova un mapping attivo per quel dominio, assegna automaticamente la società corrispondente</li>
          <li>• I mapping possono essere attivati/disattivati senza eliminarli</li>
          <li>• Esempio: utente con email "mario@primogroup.it" → società "HQ" assegnata automaticamente</li>
        </ul>
      </div>
    </div>
  );
}

