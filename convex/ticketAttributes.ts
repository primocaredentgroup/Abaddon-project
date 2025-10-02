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
    console.log(`💾 [ticketAttributes.create] Creating attribute for ticket ${ticketId}`);
    
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
      console.log(`✅ [ticketAttributes.create] Updated existing attribute`);
      return existing._id;
    } else {
      // Create new
      const id = await ctx.db.insert("ticketAttributes", {
        ticketId,
        attributeId,
        value,
      });
      console.log(`✅ [ticketAttributes.create] Created new attribute`);
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
    console.log(`📋 [ticketAttributes.getByTicket] Getting attributes for ticket ${ticketId}`);
    
    const ticketAttributes = await ctx.db
      .query("ticketAttributes")
      .withIndex("by_ticket", (q) => q.eq("ticketId", ticketId))
      .collect();

    console.log(`✅ [ticketAttributes.getByTicket] Found ${ticketAttributes.length} attributes`);

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
    console.log(`📝 [ticketAttributes.update] Updating attribute ${ticketAttributeId}`);
    
    await ctx.db.patch(ticketAttributeId, { value });
    
    console.log(`✅ [ticketAttributes.update] Attribute updated`);
    return ticketAttributeId;
  },
});

// Mutation per eliminare un ticket attribute
export const remove = mutation({
  args: {
    ticketAttributeId: v.id("ticketAttributes"),
  },
  handler: async (ctx, { ticketAttributeId }) => {
    console.log(`🗑️ [ticketAttributes.remove] Removing attribute ${ticketAttributeId}`);
    
    await ctx.db.delete(ticketAttributeId);
    
    console.log(`✅ [ticketAttributes.remove] Attribute removed`);
    return ticketAttributeId;
  },
});
