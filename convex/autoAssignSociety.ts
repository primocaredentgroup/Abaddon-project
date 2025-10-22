import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Mutation che controlla e assegna automaticamente la società basata sul dominio email
// Viene chiamata ad ogni caricamento dell'app, dopo il login
export const checkAndAssignSociety = mutation({
  args: {},
  handler: async (ctx) => {
    // Ottieni l'identità dell'utente autenticato
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { assigned: false, reason: "Non autenticato" };
    }

    // Trova l'utente
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q: any) => q.eq("auth0Id", identity.subject))
      .unique();

    if (!user) {
      return { assigned: false, reason: "Utente non trovato" };
    }

    const email = user.email.toLowerCase();

    // Controllo se l'utente ha già una società assegnata
    const existingUserSociety = await ctx.db
      .query("userSocieties")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .first();

    // Se ha già una società, non faccio nulla
    if (existingUserSociety) {
      return { 
        assigned: false, 
        reason: "Utente ha già una società assegnata",
        alreadyAssigned: true 
      };
    }

    // Estraggo il dominio dall'email (es. mario@primogroup.it → primogroup.it)
    const emailParts = email.split("@");
    if (emailParts.length !== 2) {
      return { assigned: false, reason: "Email non valida" };
    }

    const domain = emailParts[1];

    // Cerco un mapping attivo per questo dominio
    const domainMapping = await ctx.db
      .query("domainSocieties")
      .withIndex("by_domain_active", (q: any) =>
        q.eq("domain", domain).eq("isActive", true)
      )
      .first();

    if (!domainMapping) {
      return { 
        assigned: false, 
        reason: `Nessun mapping attivo trovato per il dominio ${domain}`,
        domain 
      };
    }

    // Verifico che la società esista e sia attiva
    const society: any = await ctx.db.get(domainMapping.societyId);
    if (!society) {
      return { 
        assigned: false, 
        reason: "Società non trovata nel mapping",
        domain 
      };
    }

    if (!society.isActive) {
      return { 
        assigned: false, 
        reason: `Società ${society.name} non è attiva`,
        domain,
        societyName: society.name 
      };
    }

    // Assegno automaticamente la società all'utente
    const userSocietyId = await ctx.db.insert("userSocieties", {
      userId: user._id,
      societyId: society._id,
      assignedBy: user._id, // Auto-assegnato
      assignedAt: Date.now(),
      isActive: true,
    });

    return {
      assigned: true,
      reason: "Società assegnata con successo",
      domain,
      societyName: society.name,
      societyCode: society.code,
      userSocietyId,
    };
  },
});

