import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Migration per popolare userClinics con dati esistenti da users.clinicId
export const populateUserClinicsFromExisting = mutation({
  args: {},
  returns: v.object({
    usersProcessed: v.number(),
    relationshipsCreated: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx) => {
    console.log("🔄 Starting userClinics population migration...");

    const allUsers = await ctx.db.query("users").collect();
    let usersProcessed = 0;
    let relationshipsCreated = 0;
    const errors: string[] = [];

    for (const user of allUsers) {
      usersProcessed++;

      // Skip se utente non ha clinicId
      if (!user.clinicId) {
        console.log(`⚠️ User ${user.email} has no clinicId, skipping`);
        continue;
      }

      try {
        // Verifica se esiste già una relazione
        const existingRelation = await ctx.db
          .query("userClinics")
          .withIndex("by_user_clinic", (q) =>
            q.eq("userId", user._id).eq("clinicId", user.clinicId!)
          )
          .unique();

        if (existingRelation) {
          console.log(`✓ User ${user.email} already has userClinics relation`);
          continue;
        }

        // Verifica che la clinica esista
        const clinic = await ctx.db.get(user.clinicId);
        if (!clinic) {
          errors.push(`User ${user.email}: clinic ${user.clinicId} not found`);
          continue;
        }

        // Crea la relazione userClinics
        await ctx.db.insert("userClinics", {
          userId: user._id,
          clinicId: user.clinicId,
          externalClinicId: clinic.externalClinicId, // Sarà undefined per DEMO001
          role: "user", // Default role
          isActive: true,
          joinedAt: user._creationTime, // Usa data creazione utente
        });

        relationshipsCreated++;
        console.log(`✅ Created userClinics relation for ${user.email}`);
      } catch (error) {
        const errorMsg = `User ${user.email}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    console.log(`✅ Migration completed: ${usersProcessed} users processed, ${relationshipsCreated} relationships created`);

    return {
      usersProcessed,
      relationshipsCreated,
      errors,
    };
  },
});

