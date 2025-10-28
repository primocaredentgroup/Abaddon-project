import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Mutation per creare le cliniche di sistema HQ e LABORATORIO
 * Queste cliniche vengono associate automaticamente agli utenti che hanno
 * le società corrispondenti in PrimoUp
 */
export const createSystemClinics = mutation({
  args: {},
  returns: v.object({
    hqId: v.union(v.id("clinics"), v.null()),
    laboratorioId: v.union(v.id("clinics"), v.null()),
  }),
  handler: async (ctx) => {
    // 1. Crea o recupera clinica HQ
    let hqClinic = await ctx.db
      .query("clinics")
      .filter((q) => q.eq(q.field("code"), "HQ"))
      .unique();

    let hqId = null;
    if (!hqClinic) {
      hqId = await ctx.db.insert("clinics", {
        code: "HQ",
        name: "Headquarter",
        address: "Sede Centrale",
        phone: "+39 000 0000000",
        email: "hq@primoup.it",
        isActive: true,
        isSystem: true, // 🏢 Clinica di sistema
        settings: {
          allowPublicTickets: true,
          requireApprovalForCategories: false,
          defaultSlaHours: 24,
        },
      });
      console.log("✅ Clinica HQ creata:", hqId);
    } else {
      hqId = hqClinic._id;
      console.log("✅ Clinica HQ già esistente:", hqId);
    }

    // 2. Crea o recupera clinica LABORATORIO
    let laboratorioClinic = await ctx.db
      .query("clinics")
      .filter((q) => q.eq(q.field("code"), "LABORATORIO"))
      .unique();

    let laboratorioId = null;
    if (!laboratorioClinic) {
      laboratorioId = await ctx.db.insert("clinics", {
        code: "LABORATORIO",
        name: "Laboratorio",
        address: "Laboratorio Centrale",
        phone: "+39 000 0000000",
        email: "lab@primoup.it",
        isActive: true,
        isSystem: true, // 🏢 Clinica di sistema
        settings: {
          allowPublicTickets: true,
          requireApprovalForCategories: false,
          defaultSlaHours: 24,
        },
      });
      console.log("✅ Clinica LABORATORIO creata:", laboratorioId);
    } else {
      laboratorioId = laboratorioClinic._id;
      console.log("✅ Clinica LABORATORIO già esistente:", laboratorioId);
    }

    return {
      hqId,
      laboratorioId,
    };
  },
});

// Query per ottenere una clinica di sistema per codice
export const getSystemClinic = query({
  args: {
    code: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("clinics"),
      name: v.string(),
      code: v.string(),
      address: v.string(),
      phone: v.string(),
      email: v.string(),
      externalClinicId: v.optional(v.string()),
      isActive: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, { code }) => {
    const clinic = await ctx.db
      .query("clinics")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();

    if (!clinic) {
      return null;
    }

    return {
      _id: clinic._id,
      name: clinic.name,
      code: clinic.code,
      address: clinic.address,
      phone: clinic.phone,
      email: clinic.email,
      externalClinicId: clinic.externalClinicId,
      isActive: clinic.isActive,
    };
  },
});

