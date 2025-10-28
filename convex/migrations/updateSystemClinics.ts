import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Migration per aggiornare le cliniche HQ e LABORATORIO con isSystem: true
 * 
 * Imposta isSystem: true per tutte le cliniche con code "HQ" o "LABORATORIO"
 */
export const updateSystemClinics = mutation({
  args: {},
  returns: v.object({ 
    updated: v.number(),
    details: v.array(v.object({
      clinicId: v.id("clinics"),
      code: v.string(),
      name: v.string(),
    })),
  }),
  handler: async (ctx) => {
    console.log("🔄 Starting migration to mark HQ and LABORATORIO as system clinics...");

    // Trova tutte le cliniche con code HQ o LABORATORIO
    const allClinics = await ctx.db.query("clinics").collect();
    
    const systemClinicsToUpdate = allClinics.filter(
      c => c.code === "HQ" || c.code === "LABORATORIO"
    );

    let updated = 0;
    const details = [];

    for (const clinic of systemClinicsToUpdate) {
      // Imposta isSystem: true
      await ctx.db.patch(clinic._id, {
        isSystem: true,
      });
      
      updated++;
      details.push({
        clinicId: clinic._id,
        code: clinic.code,
        name: clinic.name,
      });
      
      console.log(`✅ Clinica ${clinic.code} (${clinic.name}) marcata come sistema`);
    }

    console.log(`✅ Migration completed: ${updated} clinics marked as system`);

    return {
      updated,
      details,
    };
  },
});

