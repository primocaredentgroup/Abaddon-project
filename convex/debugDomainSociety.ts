import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Query di debug per verificare cosa succede con l'assegnazione automatica
export const debugAutoAssign = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase();
    const emailParts = email.split("@");
    
    if (emailParts.length !== 2) {
      return {
        error: "Email non valida",
        email,
      };
    }

    const domain = emailParts[1];

    // 1. Cerco l'utente
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .first();

    if (!user) {
      return {
        error: "Utente non trovato",
        email,
        domain,
      };
    }

    // 2. Verifico se ha già una società
    const userSocieties = await ctx.db
      .query("userSocieties")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();

    const activeUserSocieties = userSocieties.filter((us: any) => us.isActive);

    // 3. Cerco il mapping per questo dominio
    const allMappings = await ctx.db
      .query("domainSocieties")
      .collect();

    const mappingForDomain = allMappings.find((m: any) => m.domain === domain);

    const activeMappingForDomain = await ctx.db
      .query("domainSocieties")
      .withIndex("by_domain_active", (q: any) =>
        q.eq("domain", domain).eq("isActive", true)
      )
      .first();

    // 4. Se c'è un mapping, verifico la società
    let society: any = null;
    if (mappingForDomain) {
      society = await ctx.db.get(mappingForDomain.societyId);
    }

    return {
      email,
      domain,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      userSocieties: {
        total: userSocieties.length,
        active: activeUserSocieties.length,
        list: await Promise.all(
          activeUserSocieties.map(async (us: any) => {
            const soc: any = await ctx.db.get(us.societyId);
            return {
              societyId: us.societyId,
              societyName: soc?.name,
              isActive: us.isActive,
            };
          })
        ),
      },
      mapping: {
        found: !!mappingForDomain,
        foundActive: !!activeMappingForDomain,
        details: mappingForDomain
          ? {
              domain: mappingForDomain.domain,
              isActive: mappingForDomain.isActive,
              societyId: mappingForDomain.societyId,
              createdAt: mappingForDomain.createdAt,
            }
          : null,
      },
      society: society
        ? {
            id: society._id,
            name: society.name,
            code: society.code,
            isActive: society.isActive,
          }
        : null,
      allMappings: allMappings.map((m: any) => ({
        domain: m.domain,
        isActive: m.isActive,
        societyId: m.societyId,
      })),
      shouldAssign:
        activeUserSocieties.length === 0 &&
        !!activeMappingForDomain &&
        !!society &&
        society.isActive,
      reason: activeUserSocieties.length > 0
        ? "Utente ha già una società"
        : !mappingForDomain
        ? "Mapping non trovato"
        : !mappingForDomain.isActive
        ? "Mapping non attivo"
        : !society
        ? "Società non trovata"
        : !society.isActive
        ? "Società non attiva"
        : "Dovrebbe assegnare!",
    };
  },
});

// Mutation per forzare l'assegnazione manualmente (solo per test)
export const forceAssign = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase();
    const emailParts = email.split("@");

    if (emailParts.length !== 2) {
      throw new Error("Email non valida");
    }

    const domain = emailParts[1];

    // 1. Trovo l'utente
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .first();

    if (!user) {
      throw new Error("Utente non trovato");
    }

    // 2. Verifico se ha già una società
    const existingUserSociety = await ctx.db
      .query("userSocieties")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .first();

    if (existingUserSociety) {
      throw new Error("Utente ha già una società assegnata");
    }

    // 3. Trovo il mapping
    const domainMapping = await ctx.db
      .query("domainSocieties")
      .withIndex("by_domain_active", (q: any) =>
        q.eq("domain", domain).eq("isActive", true)
      )
      .first();

    if (!domainMapping) {
      throw new Error(`Nessun mapping attivo trovato per il dominio ${domain}`);
    }

    // 4. Verifico la società
    const society: any = await ctx.db.get(domainMapping.societyId);
    if (!society) {
      throw new Error("Società non trovata");
    }

    if (!society.isActive) {
      throw new Error("Società non attiva");
    }

    // 5. Assegno la società
    const userSocietyId = await ctx.db.insert("userSocieties", {
      userId: user._id,
      societyId: society._id,
      assignedBy: user._id,
      assignedAt: Date.now(),
      isActive: true,
    });

    return {
      success: true,
      message: `Società ${society.name} assegnata con successo a ${email}`,
      userSocietyId,
      society: {
        id: society._id,
        name: society.name,
        code: society.code,
      },
    };
  },
});

