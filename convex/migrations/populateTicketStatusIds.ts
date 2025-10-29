import { mutation } from "../_generated/server";

/**
 * Migration per popolare ticketStatusId su tutti i ticket esistenti
 * Converte il campo `status` (slug) in `ticketStatusId` (ID)
 */
export const populateTicketStatusIds = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🔄 Inizio migrazione ticketStatusIds...");
    
    // Carica tutti i ticket
    const allTickets = await ctx.db.query("tickets").collect();
    console.log(`📊 Trovati ${allTickets.length} ticket da migrare`);
    
    // Carica tutti gli stati disponibili
    const allStatuses = await ctx.db.query("ticketStatuses").collect();
    console.log(`📋 Stati disponibili: ${allStatuses.map(s => s.slug).join(", ")}`);
    
    // Crea mappa slug -> ID per lookup veloce
    const statusMap = new Map(allStatuses.map(s => [s.slug, s._id]));
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const ticket of allTickets) {
      try {
        // Skip se ha già ticketStatusId
        if (ticket.ticketStatusId) {
          skipped++;
          continue;
        }
        
        // Cerca l'ID corrispondente allo slug
        const statusId = statusMap.get(ticket.status);
        
        if (!statusId) {
          console.warn(`⚠️  Ticket ${ticket._id}: stato '${ticket.status}' non trovato in ticketStatuses`);
          errors++;
          continue;
        }
        
        // Aggiorna il ticket
        await ctx.db.patch(ticket._id, {
          ticketStatusId: statusId
        });
        
        migrated++;
        
        if (migrated % 100 === 0) {
          console.log(`✅ Migrati ${migrated} ticket...`);
        }
      } catch (error) {
        console.error(`❌ Errore migrando ticket ${ticket._id}:`, error);
        errors++;
      }
    }
    
    console.log(`
🎉 Migrazione completata!
- Migrati: ${migrated}
- Skipped (già migrati): ${skipped}
- Errori: ${errors}
- Totale: ${allTickets.length}
    `);
    
    return {
      success: true,
      message: `Migrati ${migrated} ticket`,
      migrated,
      skipped,
      errors,
      total: allTickets.length
    };
  },
});

