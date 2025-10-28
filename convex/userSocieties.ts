import { v } from "convex/values";
import { query } from "./_generated/server";

// Query per ottenere le società di un utente (con dati popolati)
export const getUserSocieties = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const links = await ctx.db
      .query("userSocieties")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Popola i dati delle società
    return await Promise.all(
      links.map(async (link) => {
        const society = await ctx.db.get(link.societyId);
        return {
          ...link,
          society,
        };
      })
    );
  },
});

