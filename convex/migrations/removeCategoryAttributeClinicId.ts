import { internalMutation } from "../_generated/server";

/**
 * Migration per rimuovere clinicId da tutti i categoryAttributes esistenti
 * Questa migration è idempotente
 */
export const removeCategoryAttributeClinicId = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("Starting migration to remove clinicId from categoryAttributes...");

    // Ottieni tutti i categoryAttributes
    const allAttributes = await ctx.db.query("categoryAttributes").collect();
    
    let migrated = 0;
    let skipped = 0;

    for (const attribute of allAttributes) {
      // @ts-ignore - Ignoriamo il tipo perché stiamo fixando vecchi dati
      if (attribute.clinicId !== undefined) {
        // Rimuovi il campo clinicId
        await ctx.db.patch(attribute._id, {
          // @ts-ignore
          clinicId: undefined,
        });
        migrated++;
      } else {
        skipped++;
      }
    }

    console.log(`Migration completed. ${migrated} categoryAttributes migrated, ${skipped} already ok.`);
    return {
      total: allAttributes.length,
      migrated,
      skipped,
      message: `✅ Removed clinicId from ${migrated} categoryAttributes, ${skipped} were already ok`
    };
  },
});

