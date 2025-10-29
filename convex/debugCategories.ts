import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Query di DEBUG per capire perché le categorie non appaiono
 * Mostra tutte le informazioni utili per il debugging
 */
export const debugCategoryVisibility = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    totalCategories: v.number(),
    publicCategories: v.number(),
    activeCategories: v.number(),
    userSocieties: v.array(v.object({
      societyId: v.id("societies"),
      societyName: v.string(),
    })),
    categoriesWithSocieties: v.array(v.object({
      categoryId: v.id("categories"),
      categoryName: v.string(),
      isPublic: v.boolean(),
      isActive: v.boolean(),
      societyIds: v.optional(v.array(v.id("societies"))),
      societyNames: v.array(v.string()),
      visibleToUser: v.boolean(),
      reason: v.string(),
    })),
    filteredCategories: v.array(v.object({
      _id: v.id("categories"),
      name: v.string(),
      visibility: v.union(v.literal("public"), v.literal("private")),
      isActive: v.boolean(),
    })),
  }),
  handler: async (ctx, { userId }) => {
    // 1. Ottieni tutte le categorie
    const allCategories = await ctx.db.query("categories")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
    
    const publicCategories = allCategories.filter(c => c.visibility === "public");
    const activeCategories = allCategories.filter(c => c.isActive);
    
    // 2. Ottieni le società dell'utente
    const userSocietiesData = await ctx.db
      .query("userSocieties")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const societyIds = userSocietiesData.map(us => us.societyId);
    
    // Carica i nomi delle società
    const userSocieties = await Promise.all(
      userSocietiesData.map(async (us) => {
        const society = await ctx.db.get(us.societyId);
        return {
          societyId: us.societyId,
          societyName: society?.name || "Sconosciuta",
        };
      })
    );
    
    // 3. Analizza ogni categoria
    const categoriesWithSocieties = await Promise.all(
      allCategories.map(async (cat) => {
        let visibleToUser = false;
        let reason = "";
        
        // Check visibilità
        if (cat.visibility !== "public") {
          reason = "❌ Non pubblica (visibility !== 'public')";
        } else if (!cat.isActive) {
          reason = "❌ Non attiva (isActive = false)";
        } else if (!cat.societyIds || cat.societyIds.length === 0) {
          visibleToUser = true;
          reason = "✅ Visibile a TUTTI (nessuna restrizione società)";
        } else {
          const hasAccess = cat.societyIds.some(sid => societyIds.includes(sid));
          if (hasAccess) {
            visibleToUser = true;
            reason = "✅ Hai accesso tramite società";
          } else {
            reason = `❌ Richiede società specifiche che non hai`;
          }
        }
        
        // Carica nomi delle società della categoria
        const societyNames = cat.societyIds 
          ? await Promise.all(
              cat.societyIds.map(async (sid) => {
                const soc = await ctx.db.get(sid);
                return soc?.name || "Sconosciuta";
              })
            )
          : [];
        
        return {
          categoryId: cat._id,
          categoryName: cat.name,
          isPublic: cat.visibility === "public",
          isActive: cat.isActive,
          societyIds: cat.societyIds,
          societyNames,
          visibleToUser,
          reason,
        };
      })
    );
    
    // 4. Categorie filtrate (quelle che dovresti vedere)
    const filteredCategories = allCategories.filter(cat => {
      if (cat.visibility !== "public") return false;
      if (!cat.isActive) return false;
      if (!cat.societyIds || cat.societyIds.length === 0) return true;
      return cat.societyIds.some(sid => societyIds.includes(sid));
    }).map(cat => ({
      _id: cat._id,
      name: cat.name,
      visibility: cat.visibility,
      isActive: cat.isActive,
    }));
    
    return {
      totalCategories: allCategories.length,
      publicCategories: publicCategories.length,
      activeCategories: activeCategories.length,
      userSocieties,
      categoriesWithSocieties,
      filteredCategories,
    };
  },
});


