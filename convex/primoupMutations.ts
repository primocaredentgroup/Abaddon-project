import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Internal mutation per sincronizzare una singola clinica
export const syncSingleClinic = internalMutation({
  args: {
    userId: v.id("users"),
    externalClinicId: v.string(),
    clinicData: v.object({
      name: v.string(),
      code: v.string(),
      address: v.string(),
      phone: v.string(),
      email: v.string(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { userId, externalClinicId, clinicData }) => {
    // Cerca clinica esistente per externalClinicId
    let clinic = await ctx.db
      .query("clinics")
      .withIndex("by_external_id", (q) => q.eq("externalClinicId", externalClinicId))
      .unique();

    let clinicId: Id<"clinics">;

    if (clinic) {
      // Clinica esiste: aggiorna dati se diversi
      await ctx.db.patch(clinic._id, {
        name: clinicData.name,
        address: clinicData.address,
        phone: clinicData.phone,
        email: clinicData.email,
        lastSyncAt: Date.now(),
      });
      clinicId = clinic._id;
    } else {
      // Clinica NON esiste: creala
      clinicId = await ctx.db.insert("clinics", {
        name: clinicData.name,
        code: clinicData.code,
        address: clinicData.address,
        phone: clinicData.phone,
        email: clinicData.email,
        externalClinicId,
        lastSyncAt: Date.now(),
        settings: {
          allowPublicTickets: true,
          requireApprovalForCategories: false,
          defaultSlaHours: 24,
        },
        isActive: true,
      });
    }

    // Cerca relazione userClinics esistente
    const existingUserClinic = await ctx.db
      .query("userClinics")
      .withIndex("by_user_clinic", (q) =>
        q.eq("userId", userId).eq("clinicId", clinicId)
      )
      .unique();

    if (existingUserClinic) {
      // Relazione esiste: assicurati che sia attiva
      await ctx.db.patch(existingUserClinic._id, {
        isActive: true,
        externalClinicId,
      });
    } else {
      // Relazione NON esiste: creala
      await ctx.db.insert("userClinics", {
        userId,
        clinicId,
        externalClinicId,
        role: "user", // Default role, può essere aggiornato successivamente
        isActive: true,
        joinedAt: Date.now(),
      });
    }

    return null;
  },
});

// Internal mutation per disattivare cliniche rimosse da PrimoUp
export const deactivateRemovedClinics = internalMutation({
  args: {
    userId: v.id("users"),
    activeExternalClinicIds: v.array(v.string()),
  },
  returns: v.number(),
  handler: async (ctx, { userId, activeExternalClinicIds }) => {
    // Ottieni tutte le userClinics attive dell'utente
    const userClinics = await ctx.db
      .query("userClinics")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("isActive", true)
      )
      .collect();

    let deactivated = 0;

    for (const userClinic of userClinics) {
      // Skip cliniche di sistema (HQ, LABORATORIO, ecc.)
      if (userClinic.externalClinicId?.startsWith("SYSTEM_")) {
        continue; // Non disattivare le cliniche di sistema
      }
      
      // Se la clinica ha un externalClinicId e NON è nella lista attiva → disattiva
      if (
        userClinic.externalClinicId &&
        !activeExternalClinicIds.includes(userClinic.externalClinicId)
      ) {
        await ctx.db.patch(userClinic._id, { isActive: false });
        deactivated++;
      }
    }

    return deactivated;
  },
});

// Internal mutation per aggiornare timestamp sync utente
export const updateUserSyncTimestamp = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    await ctx.db.patch(userId, {
      lastClinicSyncAt: Date.now(),
    });
    return null;
  },
});

// Internal mutation per collegare un utente a una clinica esistente (NO creazione, evita race conditions)
export const linkUserToClinic = internalMutation({
  args: {
    userId: v.id("users"),
    clinicId: v.id("clinics"),
    externalClinicId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { userId, clinicId, externalClinicId }) => {
    // Cerca relazione userClinics esistente
    const existingUserClinic = await ctx.db
      .query("userClinics")
      .withIndex("by_user_clinic", (q) =>
        q.eq("userId", userId).eq("clinicId", clinicId)
      )
      .unique();

    if (existingUserClinic) {
      // Relazione esiste: assicurati che sia attiva
      await ctx.db.patch(existingUserClinic._id, {
        isActive: true,
        externalClinicId,
      });
      console.log(`✅ Clinica ${externalClinicId} già collegata a utente ${userId}, riattivata.`);
    } else {
      // Relazione NON esiste: creala
      await ctx.db.insert("userClinics", {
        userId,
        clinicId,
        externalClinicId,
        role: "user", // Default role
        isActive: true,
        joinedAt: Date.now(),
      });
      console.log(`✅ Clinica ${externalClinicId} collegata a utente ${userId}.`);
    }

    return null;
  },
});

// Internal mutation per impostare/rilasciare il flag di sync
export const setSyncFlag = internalMutation({
  args: {
    userId: v.id("users"),
    isSyncing: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { userId, isSyncing }) => {
    await ctx.db.patch(userId, { isSyncing });
    return null;
  },
});

