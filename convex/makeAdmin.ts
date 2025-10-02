// ⚠️ MUTATION TEMPORANEA SOLO PER SVILUPPO
// Questa mutation rende un utente amministratore
// Da rimuovere in produzione!

import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const makeUserAdmin = mutation({
  args: {
    userEmail: v.string(),
  },
  handler: async (ctx, { userEmail }) => {
    console.log(`🔧 Cercando utente: ${userEmail}`);
    
    // Trova l'utente
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first();
    
    if (!user) {
      throw new Error(`Utente non trovato: ${userEmail}`);
    }
    
    console.log(`✅ Utente trovato: ${user.name}`);
    
    // Trova il ruolo Admin
    const adminRole = await ctx.db
      .query("roles")
      .filter((q) => q.eq(q.field("name"), "Amministratore"))
      .first();
    
    if (!adminRole) {
      throw new Error("Ruolo Amministratore non trovato");
    }
    
    console.log(`✅ Ruolo Admin trovato: ${adminRole._id}`);
    
    // Aggiorna l'utente
    await ctx.db.patch(user._id, {
      roleId: adminRole._id,
    });
    
    console.log(`🎉 Utente ${userEmail} è ora AMMINISTRATORE!`);
    
    return {
      success: true,
      userId: user._id,
      newRoleId: adminRole._id,
      message: `${user.name} è ora amministratore!`
    };
  },
});

