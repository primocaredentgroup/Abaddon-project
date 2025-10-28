import { mutation } from "../_generated/server";

/**
 * Migration per inizializzare gli stati di default dei ticket
 * Popola la tabella ticketStatuses con i 3 stati base:
 * - Aperto (open)
 * - In Corso (in_progress)
 * - Chiuso (closed)
 */
export const initializeTicketStatuses = mutation({
  args: {},
  handler: async (ctx) => {
    // Controlla se ci sono già stati nella tabella
    const existingStatuses = await ctx.db.query("ticketStatuses").collect();
    
    if (existingStatuses.length > 0) {
      console.log(`⚠️ Tabella ticketStatuses già popolata (${existingStatuses.length} stati trovati). Skip.`);
      return { 
        success: true, 
        message: `Tabella già popolata con ${existingStatuses.length} stati`,
        skipped: true,
        count: 0
      };
    }

    // Stati di default del sistema
    const defaultStatuses = [
      {
        name: "Aperto",
        slug: "open",
        description: "Ticket appena creato, in attesa di lavorazione",
        color: "#ef4444", // red-500
        icon: "circle",
        order: 1,
        isSystem: true,
        isActive: true,
        isFinal: false,
      },
      {
        name: "In Corso",
        slug: "in_progress",
        description: "Ticket in lavorazione da un agente",
        color: "#f59e0b", // amber-500
        icon: "clock",
        order: 2,
        isSystem: true,
        isActive: true,
        isFinal: false,
      },
      {
        name: "Chiuso",
        slug: "closed",
        description: "Ticket completato e chiuso",
        color: "#22c55e", // green-500
        icon: "check-circle",
        order: 3,
        isSystem: true,
        isActive: true,
        isFinal: true,
      }
    ];

    // Inserisci gli stati nel database
    let insertedCount = 0;
    for (const status of defaultStatuses) {
      await ctx.db.insert("ticketStatuses", status);
      insertedCount++;
      console.log(`✅ Stato "${status.name}" (${status.slug}) creato`);
    }

    console.log(`🎉 Migration completata: ${insertedCount} stati inizializzati`);
    
    return { 
      success: true, 
      message: `${insertedCount} stati creati con successo`,
      skipped: false,
      count: insertedCount,
      statuses: defaultStatuses.map(s => ({ name: s.name, slug: s.slug }))
    };
  },
});

