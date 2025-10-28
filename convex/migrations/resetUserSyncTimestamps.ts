import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Migration per resettare i timestamp di sync delle cliniche per tutti gli utenti
 * 
 * ⚠️ SOLO PER TESTING!
 * 
 * Resetta:
 * - lastClinicSyncAt → undefined (forza re-sync al prossimo login)
 * - isSyncing → false (rilascia eventuali lock bloccati)
 * 
 * Usala quando vuoi testare il comportamento del primo accesso giornaliero
 * senza dover aspettare 24 ore.
 */
export const resetUserSyncTimestamps = mutation({
  args: {},
  returns: v.object({ 
    usersReset: v.number(),
    details: v.string(),
  }),
  handler: async (ctx) => {
    console.log("🔄 Starting reset of user sync timestamps...");

    const allUsers = await ctx.db.query("users").collect();
    let usersReset = 0;

    for (const user of allUsers) {
      // Resetta i campi di sync
      await ctx.db.patch(user._id, {
        lastClinicSyncAt: undefined, // Forza re-sync
        isSyncing: false,             // Rilascia eventuali lock
      });
      
      usersReset++;
      console.log(`✅ Reset sync per utente: ${user.email}`);
    }

    const message = `Reset completato per ${usersReset} utenti. Ora tutti gli utenti faranno il sync al prossimo login.`;
    console.log(`✅ ${message}`);

    return {
      usersReset,
      details: message,
    };
  },
});

