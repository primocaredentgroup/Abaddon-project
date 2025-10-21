/**
 * Helper functions per controllare i permessi nel frontend senza hardcoding dei nomi dei ruoli
 */

/**
 * Controlla se un ruolo ha full access (è amministratore)
 */
export function hasFullAccess(role: any): boolean {
  return role?.permissions?.includes("full_access") ?? false;
}

/**
 * Controlla se un ruolo può gestire tutti i ticket (agente o admin)
 */
export function canManageAllTickets(role: any): boolean {
  if (!role) return false;
  return hasFullAccess(role) || (role.permissions?.includes("view_all_tickets") ?? false);
}

/**
 * Controlla se un ruolo può modificare ticket (agente o admin)
 */
export function canEditTickets(role: any): boolean {
  if (!role) return false;
  return hasFullAccess(role) || (role.permissions?.includes("edit_tickets") ?? false);
}

/**
 * Controlla se un ruolo può gestire competenze categorie (agente o admin)
 */
export function canManageCompetencies(role: any): boolean {
  return canManageAllTickets(role);
}

/**
 * Controlla se un ruolo può creare viste personalizzate (agente o admin)
 */
export function canCreatePersonalViews(role: any): boolean {
  return canManageAllTickets(role);
}

/**
 * Controlla se un ruolo può modificare regole SLA (agente o admin)
 */
export function canEditSLA(role: any): boolean {
  return canManageAllTickets(role);
}

/**
 * Mappa un ruolo a una stringa semplice per UI (mantiene compatibilità)
 */
export function getRoleType(role: any): "admin" | "agent" | "user" {
  if (!role) return "user";
  if (hasFullAccess(role)) return "admin";
  if (canManageAllTickets(role)) return "agent";
  return "user";
}

