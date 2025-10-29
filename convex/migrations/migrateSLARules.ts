import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * 🔄 MIGRAZIONE: Refactor SLA Rules
 * 
 * OBIETTIVO:
 * - Rimuovere campo `clinicId` (logicamente sbagliato)
 * - Aggiungere campo `societyIds` (corretto)
 * 
 * LOGICA:
 * 1. Per ogni regola SLA esistente
 * 2. Guarda le categorie in `conditions.categories`
 * 3. Trova le società associate a quelle categorie
 * 4. Salva `societyIds` sulla regola
 * 5. Rimuove `clinicId`
 * 
 * Se una regola non ha categorie specificate → societyIds = [] (globale)
 */
export const migrateSLARules = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("🔄 Inizio migrazione SLA Rules...");
    
    const allRules = await ctx.db.query("slaRules").collect();
    console.log(`📊 Trovate ${allRules.length} regole SLA`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const rule of allRules) {
      try {
        console.log(`\n📋 Processo regola "${rule.name}" (${rule._id})`);
        
        // @ts-ignore - clinicId esiste ancora nei documenti vecchi
        const oldClinicId = rule.clinicId;
        console.log(`  📍 clinicId vecchio: ${oldClinicId}`);
        
        // Estrai categorie dalla condizione
        const conditions = rule.conditions as any;
        const categoryIds = conditions?.categories || [];
        
        console.log(`  📂 Categorie nella regola: ${categoryIds.length}`);
        
        // Se non ci sono categorie, regola globale
        if (categoryIds.length === 0) {
          console.log("  🌍 Regola globale (nessuna categoria) → societyIds = undefined");
          
          await ctx.db.patch(rule._id, {
            societyIds: undefined,
            // @ts-ignore - Rimuovi clinicId
            clinicId: undefined,
          });
          
          migrated++;
          continue;
        }
        
        // Trova società associate alle categorie
        const societyIdsSet = new Set<Id<"societies">>();
        
        for (const categoryId of categoryIds) {
          // Carica categoria usando query invece di get per avere il tipo corretto
          const category = await ctx.db
            .query("categories")
            .filter((q) => q.eq(q.field("_id"), categoryId))
            .first();
          
          if (!category) {
            console.log(`  ⚠️  Categoria ${categoryId} non trovata!`);
            continue;
          }
          
          console.log(`  📁 Categoria "${category.name}"`);
          
          // Se la categoria ha societyIds, aggiungile
          if (category.societyIds && category.societyIds.length > 0) {
            category.societyIds.forEach(sid => societyIdsSet.add(sid));
            console.log(`    → Società: ${category.societyIds.join(", ")}`);
          } else {
            console.log(`    → Nessuna società specifica (globale)`);
          }
        }
        
        const societyIds = Array.from(societyIdsSet) as Id<"societies">[];
        
        console.log(`  ✅ Società totali trovate: ${societyIds.length}`);
        
        // Aggiorna la regola
        await ctx.db.patch(rule._id, {
          societyIds: societyIds.length > 0 ? societyIds : undefined,
          // @ts-ignore - Rimuovi clinicId
          clinicId: undefined,
        });
        
        migrated++;
        console.log(`  ✨ Regola aggiornata con successo`);
        
      } catch (error) {
        console.error(`  ❌ Errore su regola ${rule._id}:`, error);
        errors++;
      }
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("📊 MIGRAZIONE COMPLETATA");
    console.log(`  ✅ Migrate: ${migrated}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errori: ${errors}`);
    console.log("=".repeat(60));
    
    return {
      total: allRules.length,
      migrated,
      skipped,
      errors,
      message: `✅ Migrazione completata: ${migrated}/${allRules.length} regole aggiornate`
    };
  },
});

