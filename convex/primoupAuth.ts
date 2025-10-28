import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Mutation per storare/aggiornare il token PrimoUp
export const storeToken = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    // Disattiva tutti i token esistenti
    const existingTokens = await ctx.db
      .query("primoup_tokens")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    for (const existingToken of existingTokens) {
      await ctx.db.patch(existingToken._id, { isActive: false });
    }

    // Crea il nuovo token attivo
    await ctx.db.insert("primoup_tokens", {
      token,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    });

    return null;
  },
});

// Query per recuperare il token attivo
export const getActiveToken = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const tokenDoc = await ctx.db
      .query("primoup_tokens")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .unique();

    return tokenDoc?.token || null;
  },
});

// Mutation per invalidare il token corrente
export const invalidateToken = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const activeToken = await ctx.db
      .query("primoup_tokens")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .unique();

    if (activeToken) {
      await ctx.db.patch(activeToken._id, { isActive: false });
    }

    return null;
  },
});

