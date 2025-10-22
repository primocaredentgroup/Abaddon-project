"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth0 } from "@auth0/auth0-react";

/**
 * Componente che controlla e assegna automaticamente la società
 * basata sul dominio email dell'utente ad ogni login
 */
export function AutoAssignSociety() {
  const { isAuthenticated, isLoading } = useAuth0();
  const checkAndAssign = useMutation(api.autoAssignSociety.checkAndAssignSociety);
  const hasChecked = useRef(false);

  useEffect(() => {
    // Se non è autenticato o sta ancora caricando, non fare nulla
    if (!isAuthenticated || isLoading) {
      return;
    }

    // Esegui il check solo una volta per sessione
    if (hasChecked.current) {
      return;
    }

    hasChecked.current = true;

    // Esegui il check dell'assegnazione automatica
    checkAndAssign().catch(() => {
      // Ignora gli errori silenziosamente
    });
  }, [isAuthenticated, isLoading, checkAndAssign]);

  // Questo componente non renderizza nulla
  return null;
}

