import { internalMutation } from "../_generated/server";

/**
 * Migration per rimuovere clinicId da tutte le categorie esistenti
 * Questa migration è idempotente
 */
export const removeCategoryClinicId = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("Starting migration to remove clinicId from categories...");

    // Ottieni tutte le categorie
    const allCategories = await ctx.db.query("categories").collect();
    
    let migrated = 0;
    let skipped = 0;

    for (const category of allCategories) {
      // @ts-ignore - Ignoriamo il tipo perché stiamo fixando vecchi dati
      if (category.clinicId !== undefined) {
        // Rimuovi il campo clinicId
        await ctx.db.patch(category._id, {
          // @ts-ignore
          clinicId: undefined,
        });
        migrated++;
      } else {
        skipped++;
      }
    }

    console.log(`Migration completed. ${migrated} categories migrated, ${skipped} already ok.`);
    return {
      total: allCategories.length,
      migrated,
      skipped,
      message: `✅ Removed clinicId from ${migrated} categories, ${skipped} were already ok`
    };
  },
});

