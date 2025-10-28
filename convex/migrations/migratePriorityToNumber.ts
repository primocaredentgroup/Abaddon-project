import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Migration per convertire priority da stringhe a numeri (1-5)
 * 
 * Conversione:
 * - "low" → 2
 * - "medium" → 3
 * - "high" → 4
 * - "urgent" → 5
 * - null/undefined → 1
 */
export const migratePriorityToNumber = mutation({
  args: {},
  returns: v.object({ 
    migrated: v.number(),
    skipped: v.number(),
    details: v.string(),
  }),
  handler: async (ctx) => {
    console.log("🔄 Starting migration: priority string → number...");

    const allTickets = await ctx.db.query("tickets").collect();
    let migrated = 0;
    let skipped = 0;

    for (const ticket of allTickets) {
      // @ts-ignore - Accesso al campo prima della migrazione
      const oldPriority = ticket.priority;
      
      let newPriority: number;

      // Converti string → number
      if (typeof oldPriority === 'string') {
        switch (oldPriority) {
          case 'low':
            newPriority = 2;
            break;
          case 'medium':
            newPriority = 3;
            break;
          case 'high':
            newPriority = 4;
            break;
          case 'urgent':
            newPriority = 5;
            break;
          default:
            newPriority = 1; // Default per valori sconosciuti
        }
        
        // @ts-ignore - Patch temporaneo durante migrazione
        await ctx.db.patch(ticket._id, { priority: newPriority });
        migrated++;
        
      } else if (typeof oldPriority === 'number') {
        // Già numero, verifica sia nel range 1-5
        if (oldPriority < 1 || oldPriority > 5) {
          await ctx.db.patch(ticket._id, { priority: 1 });
          migrated++;
        } else {
          skipped++;
        }
      } else {
        // null/undefined → 1
        // @ts-ignore
        await ctx.db.patch(ticket._id, { priority: 1 });
        migrated++;
      }
    }

    const message = `Migration completata: ${migrated} ticket aggiornati, ${skipped} già corretti`;
    console.log(`✅ ${message}`);

    return {
      migrated,
      skipped,
      details: message,
    };
  },
});

