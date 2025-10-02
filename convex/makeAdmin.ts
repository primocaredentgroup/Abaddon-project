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

// Mutation per fixare i ruoli vecchi che non hanno isActive
export const fixOldRoles = mutation({
  handler: async (ctx) => {
    console.log("🔧 Fixing old roles without isActive field...");
    
    const allRoles = await ctx.db.query("roles").collect();
    
    let fixed = 0;
    let alreadyOk = 0;
    
    for (const role of allRoles) {
      // @ts-ignore - Ignoriamo il tipo perché stiamo fixando vecchi dati
      if (role.isActive === undefined) {
        await ctx.db.patch(role._id, {
          isActive: true,
        });
        console.log(`✅ Fixed role: ${role.name}`);
        fixed++;
      } else {
        alreadyOk++;
      }
      
      // Fix anche permissions se sono ancora ID invece di stringhe
      // @ts-ignore
      if (role.permissions && role.permissions.length > 0 && typeof role.permissions[0] !== 'string') {
        console.log(`⚠️ Role "${role.name}" has old permission format (IDs). Converting to simple permissions...`);
        await ctx.db.patch(role._id, {
          permissions: role.name === "Amministratore" 
            ? ["full_access"]
            : role.name === "Agente"
            ? ["view_all_tickets", "create_tickets", "edit_tickets", "assign_tickets"]
            : ["view_own_tickets", "create_tickets", "comment_tickets"]
        });
      }
    }
    
    return {
      total: allRoles.length,
      fixed,
      alreadyOk,
      message: `Fixed ${fixed} roles, ${alreadyOk} were already ok`
    };
  },
});

