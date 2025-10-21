import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

// Mutation per creare un ticket attribute
export const create = mutation({
  args: {
    ticketId: v.id("tickets"),
    attributeId: v.id("categoryAttributes"),
    value: v.any(),
  },
  handler: async (ctx, { ticketId, attributeId, value }) => {
    
    // Verifica se esiste già un attributo per questo ticket e attributeId
    const existing = await ctx.db
      .query("ticketAttributes")
      .withIndex("by_ticket_attribute", (q) => 
        q.eq("ticketId", ticketId).eq("attributeId", attributeId)
      )
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, { value });
      return existing._id;
    } else {
      // Create new
      const id = await ctx.db.insert("ticketAttributes", {
        ticketId,
        attributeId,
        value,
      });
      return id;
    }
  },
});

// Query per ottenere gli attributi di un ticket
export const getByTicket = query({
  args: {
    ticketId: v.id("tickets"),
  },
  handler: async (ctx, { ticketId }) => {
    
    const ticketAttributes = await ctx.db
      .query("ticketAttributes")
      .withIndex("by_ticket", (q) => q.eq("ticketId", ticketId))
      .collect();


    // Ottieni i dettagli degli attributi
    const attributesWithDetails = await Promise.all(
      ticketAttributes.map(async (ta) => {
        const attribute = await ctx.db.get(ta.attributeId);
        return {
          ...ta,
          attribute,
        };
      })
    );

    return attributesWithDetails;
  },
});

// Mutation per aggiornare un ticket attribute
export const update = mutation({
  args: {
    ticketAttributeId: v.id("ticketAttributes"),
    value: v.any(),
  },
  handler: async (ctx, { ticketAttributeId, value }) => {
    
    await ctx.db.patch(ticketAttributeId, { value });
    
    return ticketAttributeId;
  },
});

// Mutation per eliminare un ticket attribute
export const remove = mutation({
  args: {
    ticketAttributeId: v.id("ticketAttributes"),
  },
  handler: async (ctx, { ticketAttributeId }) => {
    
    await ctx.db.delete(ticketAttributeId);
    
    return ticketAttributeId;
  },
});
