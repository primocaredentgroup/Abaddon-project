"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import DomainSocietyManager from "@/components/admin/DomainSocietyManager";

export default function DomainSocietiesPage() {
  const router = useRouter();
  const currentUser = useQuery(api.users.currentUser);

  useEffect(() => {
    // Redirect se l'utente non è autenticato o non è admin
    if (currentUser === null) {
      router.push("/");
    }
  }, [currentUser, router]);

  // Controllo semplice se l'utente è admin (puoi raffinare con il sistema dei permessi)
  const isAdmin = currentUser?.roleId ? true : false; // Placeholder - implementa il check vero

  if (currentUser === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Accesso Negato</h1>
          <p className="text-gray-600">Non hai i permessi per accedere a questa pagina.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <nav className="text-sm text-gray-600">
            <a href="/admin" className="hover:text-blue-600">Admin</a>
            {" / "}
            <span className="text-gray-900 font-medium">Assegnazione Automatica Società</span>
          </nav>
        </div>
      </div>
      <DomainSocietyManager />
    </div>
  );
}

