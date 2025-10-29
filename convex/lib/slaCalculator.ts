/**
 * Helper per calcolare la deadline SLA di un ticket
 * 
 * Spiegazione semplice:
 * - Prende le regole SLA attive
 * - Trova quella che si applica al ticket
 * - Calcola quando scade (data/ora futura)
 */

import { Doc } from "../_generated/dataModel";

export interface SLACalculation {
  slaDeadline: number | undefined; // Timestamp Unix quando scade
  appliedRuleName: string | undefined; // Nome della regola applicata
  targetHours: number | undefined; // Ore target della regola
}

/**
 * Calcola la deadline SLA per un ticket
 */
export function calculateSLADeadline(
  ticket: {
    categoryId: string;
    priority: number;
    _creationTime: number;
  },
  slaRules: Doc<"slaRules">[]
): SLACalculation {
  // Se non ci sono regole SLA attive, return undefined
  if (!slaRules || slaRules.length === 0) {
    return {
      slaDeadline: undefined,
      appliedRuleName: undefined,
      targetHours: undefined,
    };
  }

  // Filtra regole applicabili a questo ticket
  const applicableRules = slaRules.filter((rule) => {
    // La regola deve essere attiva
    if (!rule.isActive) return false;

    // Se richiede approvazione e non è approvata, skip
    if (rule.requiresApproval && !rule.isApproved) return false;

    // Verifica se la regola si applica a questo ticket
    // Le conditions contengono: priority, categories, businessHoursOnly
    const conditions = rule.conditions as any;

    // Se la regola ha categorie specifiche, verifica match
    if (conditions?.categories && Array.isArray(conditions.categories)) {
      if (conditions.categories.length > 0) {
        const matchesCategory = conditions.categories.includes(ticket.categoryId);
        if (!matchesCategory) return false;
      }
    }

    // Se la regola ha priorità specifiche, verifica match
    if (conditions?.priority) {
      const rulePriority = mapPriorityToNumber(conditions.priority);
      if (rulePriority !== ticket.priority) return false;
    }

    return true;
  });

  // Se nessuna regola si applica, return undefined
  if (applicableRules.length === 0) {
    return {
      slaDeadline: undefined,
      appliedRuleName: undefined,
      targetHours: undefined,
    };
  }

  // Prendi la regola con targetHours più basso (più stringente)
  applicableRules.sort((a, b) => a.targetHours - b.targetHours);
  const appliedRule = applicableRules[0];

  // Calcola la deadline
  // ticket._creationTime è in millisecondi
  // targetHours è in ore, convertiamo in millisecondi
  const deadlineMs = ticket._creationTime + appliedRule.targetHours * 60 * 60 * 1000;

  return {
    slaDeadline: deadlineMs,
    appliedRuleName: appliedRule.name,
    targetHours: appliedRule.targetHours,
  };
}

/**
 * Mappa priority da string a number
 */
function mapPriorityToNumber(priority: string): number {
  const map: Record<string, number> = {
    low: 1,
    medium: 3,
    high: 4,
    urgent: 5,
  };
  return map[priority] || 3; // Default: medium
}

/**
 * Verifica se un ticket ha superato la deadline SLA
 */
export function isSLABreached(slaDeadline: number | undefined): boolean {
  if (!slaDeadline) return false;
  return Date.now() > slaDeadline;
}

/**
 * Calcola il tempo rimanente in formato leggibile
 */
export function formatTimeRemaining(slaDeadline: number | undefined): string {
  if (!slaDeadline) return "SLA assente";

  const now = Date.now();
  const remaining = slaDeadline - now;

  // Se scaduto
  if (remaining <= 0) {
    const overdue = Math.abs(remaining);
    const hours = Math.floor(overdue / (1000 * 60 * 60));
    const minutes = Math.floor((overdue % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `Scaduto da ${days}g ${hours % 24}h`;
    }
    return `Scaduto da ${hours}h ${minutes}m`;
  }

  // Tempo rimanente
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `Scade tra ${days}g ${hours % 24}h`;
  }
  return `Scade tra ${hours}h ${minutes}m`;
}

/**
 * Ritorna il colore in base allo stato SLA
 */
export function getSLAStatusColor(slaDeadline: number | undefined): {
  color: string;
  bgColor: string;
  label: string;
} {
  if (!slaDeadline) {
    return {
      color: "text-gray-600",
      bgColor: "bg-gray-100",
      label: "SLA assente",
    };
  }

  const now = Date.now();
  const remaining = slaDeadline - now;

  // Scaduto
  if (remaining <= 0) {
    return {
      color: "text-red-700",
      bgColor: "bg-red-100",
      label: "Scaduto",
    };
  }

  // Meno di 25% del tempo rimasto = Rosso
  const total = slaDeadline - now;
  const percentRemaining = (remaining / total) * 100;

  if (percentRemaining < 25) {
    return {
      color: "text-red-600",
      bgColor: "bg-red-50",
      label: "Urgente",
    };
  }

  // Meno di 50% = Giallo
  if (percentRemaining < 50) {
    return {
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      label: "Attenzione",
    };
  }

  // Verde (tutto ok)
  return {
    color: "text-green-600",
    bgColor: "bg-green-50",
    label: "OK",
  };
}


