import { mutation, query } from "./_generated/server";

// Mutation di test per verificare che l'autenticazione Auth0 funzioni
export const testAuthMutation = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    
    console.log("🔍 Test Autenticazione:");
    console.log("  - Identity:", identity ? "✅ PRESENTE" : "❌ ASSENTE");
    
    if (identity) {
      console.log("  - Subject:", identity.subject);
      console.log("  - Email:", identity.email);
      console.log("  - Name:", identity.name);
      console.log("  - Token ID:", identity.tokenIdentifier);
    }
    
    return {
      success: !!identity,
      identity: identity ? {
        subject: identity.subject,
        email: identity.email,
        name: identity.name,
        tokenIdentifier: identity.tokenIdentifier
      } : null,
      message: identity 
        ? "✅ Autenticazione Auth0 funzionante!" 
        : "❌ Nessuna identità trovata - l'utente non è autenticato"
    };
  }
});

// Query di test (le query non modificano il database)
export const testAuthQuery = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    
    return {
      isAuthenticated: !!identity,
      user: identity ? {
        email: identity.email,
        name: identity.name,
      } : null
    };
  }
});


