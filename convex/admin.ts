import { mutation } from "./_generated/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import { getCurrentUser } from "./lib/utils"

/**
 * Mutation pubblica per eseguire la migration di assegnazione HQ
 * Solo gli amministratori possono eseguirla
 */
export const runHQMigration = mutation({
  args: {},
  returns: v.object({
    message: v.string(),
    usersProcessed: v.number(),
    usersAssigned: v.number(),
    usersSkipped: v.number(),
  }),
  handler: async (ctx) => {
    // Verifica che l'utente sia autenticato e sia un amministratore
    const currentUser = await getCurrentUser(ctx)
    const role = await ctx.db.get(currentUser.roleId)
    
    if (!role || role.name !== "Amministratore") {
      throw new Error("Solo gli amministratori possono eseguire questa migration")
    }
    
    console.log(`🔐 Admin ${currentUser.email} sta eseguendo la migration HQ`)
    
    // Esegui la migration interna e ottieni il risultato
    type MigrationResult = {
      message: string;
      usersProcessed: number;
      usersAssigned: number;
      usersSkipped: number;
    };
    
    const migrationResult: MigrationResult = await ctx.runMutation(
      internal.migrations.assignHQToExistingUsers.assignHQToExistingUsers, 
      {}
    )
    
    return migrationResult
  }
})

