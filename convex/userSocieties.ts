import { v } from "convex/values";
import { query } from "./_generated/server";

// Query per ottenere le società di un utente
export const getUserSocieties = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userSocieties")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

