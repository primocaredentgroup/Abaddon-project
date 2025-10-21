/**
 * Helper functions per controllare i permessi senza hardcoding dei nomi dei ruoli
 */

import { Doc } from "../_generated/dataModel";

/**
 * Controlla se un ruolo ha full access (è amministratore)
 */
export function hasFullAccess(role: Doc<"roles"> | null | undefined): boolean {
  return role?.permissions?.includes("full_access") ?? false;
}

/**
 * Controlla se un ruolo può gestire tutti i ticket (agente o admin)
 */
export function canManageAllTickets(role: Doc<"roles"> | null | undefined): boolean {
  if (!role) return false;
  return hasFullAccess(role) || (role.permissions?.includes("view_all_tickets") ?? false);
}

/**
 * Controlla se un ruolo può modificare ticket (agente o admin)
 */
export function canEditTickets(role: Doc<"roles"> | null | undefined): boolean {
  if (!role) return false;
  return hasFullAccess(role) || (role.permissions?.includes("edit_tickets") ?? false);
}

/**
 * Controlla se un ruolo può assegnare ticket (agente o admin)
 */
export function canAssignTickets(role: Doc<"roles"> | null | undefined): boolean {
  if (!role) return false;
  return hasFullAccess(role) || (role.permissions?.includes("assign_tickets") ?? false);
}

/**
 * Controlla se un ruolo può creare ticket
 */
export function canCreateTickets(role: Doc<"roles"> | null | undefined): boolean {
  if (!role) return false;
  return role.permissions?.includes("create_tickets") ?? false;
}

/**
 * Controlla se un ruolo può gestire competenze categorie (agente o admin)
 */
export function canManageCompetencies(role: Doc<"roles"> | null | undefined): boolean {
  return canManageAllTickets(role);
}

/**
 * Controlla se un ruolo può creare viste personalizzate (agente o admin)
 */
export function canCreatePersonalViews(role: Doc<"roles"> | null | undefined): boolean {
  return canManageAllTickets(role);
}

/**
 * Controlla se un ruolo può modificare regole SLA (agente o admin)
 */
export function canEditSLA(role: Doc<"roles"> | null | undefined): boolean {
  return canManageAllTickets(role);
}

/**
 * Controlla se un ruolo è admin o agente (per commenti KB, notifiche, ecc)
 */
export function isAdminOrAgent(role: Doc<"roles"> | null | undefined): boolean {
  return canManageAllTickets(role);
}

/**
 * Mappa un ruolo a una stringa semplice per UI (mantiene compatibilità)
 */
export function getRoleType(role: Doc<"roles"> | null | undefined): "admin" | "agent" | "user" {
  if (!role) return "user";
  if (hasFullAccess(role)) return "admin";
  if (canManageAllTickets(role)) return "agent";
  return "user";
}

