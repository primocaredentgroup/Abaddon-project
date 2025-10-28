import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Migration per riattivare le cliniche di sistema in userClinics
 * 
 * Le cliniche di sistema (HQ, LABORATORIO) sono state disattivate per errore
 * dalla mutation deactivateRemovedClinics perché i loro externalClinicId
 * (SYSTEM_HQ, SYSTEM_LABORATORIO) non sono mai nella lista di PrimoUp.
 * 
 * Questa migration le riattiva.
 */
export const reactivateSystemClinics = mutation({
  args: {},
  returns: v.object({ 
    reactivated: v.number(),
    details: v.array(v.object({
      userId: v.id("users"),
      userEmail: v.string(),
      clinicCode: v.string(),
      clinicName: v.string(),
    })),
  }),
  handler: async (ctx) => {
    console.log("🔄 Starting migration to reactivate system clinics in userClinics...");

    // Trova tutte le userClinics con externalClinicId che inizia con "SYSTEM_"
    const allUserClinics = await ctx.db.query("userClinics").collect();
    
    const systemUserClinics = allUserClinics.filter(
      uc => uc.externalClinicId?.startsWith("SYSTEM_")
    );

    let reactivated = 0;
    const details = [];

    for (const userClinic of systemUserClinics) {
      // Se è disattivata, riattivala
      if (!userClinic.isActive) {
        await ctx.db.patch(userClinic._id, {
          isActive: true,
        });
        
        // Ottieni dati per il report
        const user = await ctx.db.get(userClinic.userId);
        const clinic = await ctx.db.get(userClinic.clinicId);
        
        if (user && clinic) {
          details.push({
            userId: user._id,
            userEmail: user.email,
            clinicCode: clinic.code,
            clinicName: clinic.name,
          });
          
          reactivated++;
          console.log(`✅ Riattivata ${clinic.code} per utente ${user.email}`);
        }
      }
    }

    console.log(`✅ Migration completed: ${reactivated} system clinics reactivated`);

    return {
      reactivated,
      details,
    };
  },
});

