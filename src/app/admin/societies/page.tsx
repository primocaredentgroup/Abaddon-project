"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { Trash2, Edit, Plus, Users, Building2, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

interface Society {
  _id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: number;
}

export default function SocietiesPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSociety, setSelectedSociety] = useState<Society | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
  });

  // Queries
  const societies = useQuery(api.societies.getAllSocieties, { activeOnly: false });

  // Mutations
  const createSociety = useMutation(api.societies.createSociety);
  const updateSociety = useMutation(api.societies.updateSociety);
  const deleteSociety = useMutation(api.societies.deleteSociety);
  const toggleSocietyStatus = useMutation(api.societies.updateSociety);

  // Form handlers
  const handleCreateSociety = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSociety(formData);
      toast.success("Società creata con successo");
      setIsCreating(false);
      setFormData({ name: "", code: "", description: "" });
    } catch (error) {
      toast.error("Errore nella creazione della società");
    }
  };

  const handleUpdateSociety = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSociety) return;
    
    try {
      await updateSociety({
        societyId: selectedSociety._id as any,
        ...formData,
      });
      toast.success("Società aggiornata con successo");
      setIsEditing(false);
      setSelectedSociety(null);
      setFormData({ name: "", code: "", description: "" });
    } catch (error) {
      toast.error("Errore nell'aggiornamento della società");
    }
  };

  const handleDeleteSociety = async (societyId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa società?")) return;
    
    try {
      await deleteSociety({ societyId: societyId as any });
      toast.success("Società eliminata con successo");
    } catch (error) {
      toast.error("Errore nell'eliminazione della società");
    }
  };

  const handleToggleStatus = async (society: Society) => {
    try {
      await toggleSocietyStatus({
        societyId: society._id as any,
        isActive: !society.isActive,
      });
      toast.success(`Società ${society.isActive ? "disattivata" : "attivata"} con successo`);
    } catch (error) {
      toast.error("Errore nell'aggiornamento dello stato");
    }
  };

  const openEditForm = (society: Society) => {
    setSelectedSociety(society);
    setFormData({
      name: society.name,
      code: society.code,
      description: society.description || "",
    });
    setIsEditing(true);
  };

  if (societies === undefined) {
    return <div>Caricamento...</div>;
  }

  const activeSocieties = societies.filter(s => s.isActive);
  const inactiveSocieties = societies.filter(s => !s.isActive);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestione Società</h1>
          <p className="text-muted-foreground">
            Gestisci le società e le assegnazioni agli utenti
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuova Società
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale Società</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{societies.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attive</CardTitle>
            <ToggleRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeSocieties.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inattive</CardTitle>
            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{inactiveSocieties.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || isEditing) && (
        <Card>
          <CardHeader>
            <CardTitle>{isCreating ? "Crea Nuova Società" : "Modifica Società"}</CardTitle>
            <CardDescription>
              {isCreating ? "Inserisci i dettagli per creare una nuova società" : "Modifica i dettagli della società"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={isCreating ? handleCreateSociety : handleUpdateSociety} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Codice</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descrizione</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="flex space-x-2">
                <Button type="submit">
                  {isCreating ? "Crea Società" : "Aggiorna Società"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                    setSelectedSociety(null);
                    setFormData({ name: "", code: "", description: "" });
                  }}
                >
                  Annulla
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Active Societies */}
      <Card>
        <CardHeader>
          <CardTitle>Società Attive</CardTitle>
          <CardDescription>
            Società attualmente attive nel sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeSocieties.map((society) => (
              <div key={society._id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium">{society.name}</h3>
                    <Badge variant="default">{society.code}</Badge>
                    <Badge className="bg-green-100 text-green-800">Attiva</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {society.description || "Nessuna descrizione"}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditForm(society)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleStatus(society)}
                  >
                    <ToggleLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteSociety(society._id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Inactive Societies */}
      {inactiveSocieties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Società Inattive</CardTitle>
            <CardDescription>
              Società disattivate che possono essere riattivate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {inactiveSocieties.map((society) => (
                <div key={society._id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium">{society.name}</h3>
                      <Badge variant="default">{society.code}</Badge>
                      <Badge className="bg-red-100 text-red-800">Inattiva</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {society.description || "Nessuna descrizione"}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(society)}
                    >
                      <ToggleRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteSociety(society._id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
