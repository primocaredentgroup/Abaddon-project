import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/utils";

// Lista tutti i mapping dominio → società
export const list = query({
  args: {
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Esegui query con o senza filtro
    const mappings = args.activeOnly
      ? await ctx.db
          .query("domainSocieties")
          .withIndex("by_active", (q) => q.eq("isActive", true))
          .collect()
      : await ctx.db.query("domainSocieties").collect();

    // Arricchisco con i dati della società
    const enrichedMappings = await Promise.all(
      mappings.map(async (mapping) => {
        const society = await ctx.db.get(mapping.societyId);
        return {
          ...mapping,
          society,
        };
      })
    );

    return enrichedMappings;
  },
});

// Ottieni mapping per un dominio specifico
export const getByDomain = query({
  args: {
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    // Normalizzo il dominio (lowercase)
    const normalizedDomain = args.domain.toLowerCase().trim();

    const mapping = await ctx.db
      .query("domainSocieties")
      .withIndex("by_domain_active", (q) =>
        q.eq("domain", normalizedDomain).eq("isActive", true)
      )
      .first();

    if (!mapping) {
      return null;
    }

    const society = await ctx.db.get(mapping.societyId);
    return {
      ...mapping,
      society,
    };
  },
});

// Crea nuovo mapping dominio → società
export const create = mutation({
  args: {
    domain: v.string(),
    societyId: v.id("societies"),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);

    // Normalizzo il dominio (lowercase, rimuovo spazi)
    const normalizedDomain = args.domain.toLowerCase().trim();

    // Controllo che la società esista
    const society = await ctx.db.get(args.societyId);
    if (!society) {
      throw new Error("Società non trovata");
    }

    // Controllo se esiste già un mapping per questo dominio
    const existingMapping = await ctx.db
      .query("domainSocieties")
      .withIndex("by_domain", (q) => q.eq("domain", normalizedDomain))
      .first();

    if (existingMapping) {
      throw new Error("Esiste già un mapping per questo dominio");
    }

    // Creo il mapping
    const mappingId = await ctx.db.insert("domainSocieties", {
      domain: normalizedDomain,
      societyId: args.societyId,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: user._id,
    });

    // Log audit
    await ctx.db.insert("auditLogs", {
      entityType: "domainSociety",
      entityId: mappingId,
      action: "create",
      userId: user._id,
      changes: {
        domain: normalizedDomain,
        societyId: args.societyId,
        societyName: society.name,
      },
    });

    return mappingId;
  },
});

// Aggiorna mapping esistente
export const update = mutation({
  args: {
    mappingId: v.id("domainSocieties"),
    domain: v.optional(v.string()),
    societyId: v.optional(v.id("societies")),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);

    const existingMapping = await ctx.db.get(args.mappingId);
    if (!existingMapping) {
      throw new Error("Mapping non trovato");
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    // Se cambio il dominio, controllo che non esista già
    if (args.domain) {
      const normalizedDomain = args.domain.toLowerCase().trim();

      if (normalizedDomain !== existingMapping.domain) {
        const duplicateMapping = await ctx.db
          .query("domainSocieties")
          .withIndex("by_domain", (q) => q.eq("domain", normalizedDomain))
          .first();

        if (duplicateMapping) {
          throw new Error("Esiste già un mapping per questo dominio");
        }

        updates.domain = normalizedDomain;
      }
    }

    // Se cambio la società, controllo che esista
    if (args.societyId) {
      const society = await ctx.db.get(args.societyId);
      if (!society) {
        throw new Error("Società non trovata");
      }
      updates.societyId = args.societyId;
    }

    if (args.isActive !== undefined) {
      updates.isActive = args.isActive;
    }

    await ctx.db.patch(args.mappingId, updates);

    // Log audit
    await ctx.db.insert("auditLogs", {
      entityType: "domainSociety",
      entityId: args.mappingId,
      action: "update",
      userId: user._id,
      changes: {
        old: existingMapping,
        new: updates,
      },
    });

    return args.mappingId;
  },
});

// Elimina mapping
export const remove = mutation({
  args: {
    mappingId: v.id("domainSocieties"),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);

    const existingMapping = await ctx.db.get(args.mappingId);
    if (!existingMapping) {
      throw new Error("Mapping non trovato");
    }

    await ctx.db.delete(args.mappingId);

    // Log audit
    await ctx.db.insert("auditLogs", {
      entityType: "domainSociety",
      entityId: args.mappingId,
      action: "delete",
      userId: user._id,
      changes: {
        old: existingMapping,
      },
    });

    return args.mappingId;
  },
});

// Funzione di inizializzazione con i mapping di default
export const initDefaultMappings = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireUser(ctx);

    // Prima verifico quali società esistono
    const allSocieties = await ctx.db.query("societies").collect();
    
    if (allSocieties.length === 0) {
      throw new Error("Nessuna società trovata nel database. Crea prima le società (HQ, Cliniche, Laboratorio).");
    }

    // Definisco i mapping di default
    const defaultMappings = [
      { domain: "primogroup.it", societyCode: "HQ" },
      { domain: "centriprimo.it", societyCode: "CLINICHE" },
      { domain: "care-dent.it", societyCode: "CLINICHE" },
      { domain: "primolab.eu", societyCode: "LABORATORIO" },
    ];

    const createdMappings = [];
    const skippedMappings = [];
    const missingCodes = [];

    for (const mapping of defaultMappings) {
      // Cerco la società per codice
      const society = await ctx.db
        .query("societies")
        .withIndex("by_code", (q) => q.eq("code", mapping.societyCode))
        .first();

      if (!society) {
        missingCodes.push(mapping.societyCode);
        skippedMappings.push({
          domain: mapping.domain,
          reason: `Società con codice "${mapping.societyCode}" non trovata`,
        });
        continue;
      }

      // Controllo se esiste già
      const existingMapping = await ctx.db
        .query("domainSocieties")
        .withIndex("by_domain", (q) => q.eq("domain", mapping.domain))
        .first();

      if (existingMapping) {
        skippedMappings.push({
          domain: mapping.domain,
          reason: "Mapping già esistente",
        });
        continue;
      }

      // Creo il mapping
      const mappingId = await ctx.db.insert("domainSocieties", {
        domain: mapping.domain,
        societyId: society._id,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: user._id,
      });

      createdMappings.push({
        domain: mapping.domain,
        society: society.name,
        societyCode: society.code,
        mappingId,
      });
    }

    // Se non ho creato nessun mapping, lancio un errore con dettagli
    if (createdMappings.length === 0 && missingCodes.length > 0) {
      throw new Error(
        `Impossibile creare mapping. Società mancanti: ${[...new Set(missingCodes)].join(", ")}. ` +
        `Società disponibili: ${allSocieties.map(s => s.code).join(", ")}`
      );
    }

    return {
      message: `Creati ${createdMappings.length} mapping di default`,
      createdMappings,
      skippedMappings,
      availableSocieties: allSocieties.map(s => ({ code: s.code, name: s.name })),
    };
  },
});

