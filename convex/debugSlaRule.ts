import { v } from "convex/values"
import { query } from "./_generated/server"

/**
 * 🔍 Query di debug per vedere esattamente cosa c'è dentro una regola SLA
 * 
 * Come usarla dal frontend:
 * 1. Prendi l'ID della tua regola SLA
 * 2. Chiama questa query con quell'ID
 * 3. Guarda la console per vedere cosa c'è dentro
 */
export const debugSLARule = query({
  args: {
    ruleId: v.id("slaRules"),
  },
  returns: v.any(),
  handler: async (ctx, { ruleId }) => {
    const rule = await ctx.db.get(ruleId)
    
    if (!rule) {
      return { error: "Regola SLA non trovata" }
    }
    
    // Estrai le conditions
    const conditions = rule.conditions as any
    
    console.log("🔍 DEBUG REGOLA SLA:")
    console.log("  ID Regola:", ruleId)
    console.log("  Nome:", rule.name)
    console.log("  Target Hours:", rule.targetHours)
    console.log("  Is Active:", rule.isActive)
    console.log("  Conditions (raw):", JSON.stringify(conditions, null, 2))
    console.log("  Categorie dentro conditions:", conditions?.categories)
    console.log("  Tipo delle categorie:", Array.isArray(conditions?.categories) ? "array" : typeof conditions?.categories)
    
    if (Array.isArray(conditions?.categories)) {
      console.log("  Numero categorie:", conditions.categories.length)
      conditions.categories.forEach((catId: any, index: number) => {
        console.log(`    [${index}] ID: "${catId}" (tipo: ${typeof catId})`)
      })
    }
    
    return {
      ruleId: ruleId,
      name: rule.name,
      targetHours: rule.targetHours,
      isActive: rule.isActive,
      conditions: conditions,
      categoriesInConditions: conditions?.categories || [],
      categoriesType: Array.isArray(conditions?.categories) ? "array" : typeof conditions?.categories,
      categoriesLength: Array.isArray(conditions?.categories) ? conditions.categories.length : 0,
    }
  }
})

/**
 * 🔍 Query di debug per vedere cosa viene confrontato quando crei un ticket
 */
export const debugTicketSLAMatching = query({
  args: {
    categoryId: v.id("categories"),
    priority: v.number(),
  },
  returns: v.any(),
  handler: async (ctx, { categoryId, priority }) => {
    console.log("🎯 DEBUG MATCHING TICKET -> SLA:")
    console.log("  Categoria ticket:", categoryId)
    console.log("  Priorità ticket:", priority)
    
    // Carica tutte le regole SLA attive
    const allRules = await ctx.db
      .query("slaRules")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect()
    
    console.log(`  Regole SLA attive trovate: ${allRules.length}`)
    
    const results: Array<any> = []
    
    for (const rule of allRules) {
      const conditions = rule.conditions as any
      const categories = conditions?.categories || []
      
      console.log(`  Regola "${rule.name}":`)
      console.log(`    Categorie nella regola:`, categories)
      console.log(`    Confronto: ${JSON.stringify(categories)} includes ${categoryId}?`)
      
      const matchesCategory = categories.length === 0 || categories.includes(categoryId)
      console.log(`    Match categoria: ${matchesCategory}`)
      
      results.push({
        ruleName: rule.name,
        ruleId: rule._id,
        categoriesInRule: categories,
        ticketCategoryId: categoryId,
        matchesCategory: matchesCategory,
        targetHours: rule.targetHours,
      })
    }
    
    return {
      ticketCategoryId: categoryId,
      ticketPriority: priority,
      totalRulesChecked: allRules.length,
      matchingResults: results,
    }
  }
})

