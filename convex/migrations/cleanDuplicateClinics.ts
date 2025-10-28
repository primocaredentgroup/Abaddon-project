import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Migration per rimuovere le cliniche duplicate HQ e LABORATORIO
 * Mantiene solo la PRIMA di ogni tipo e cancella le altre
 */
export const cleanDuplicateClinics = mutation({
  args: {},
  returns: v.object({ 
    hqRemoved: v.number(), 
    labRemoved: v.number(),
    hqKept: v.union(v.id("clinics"), v.null()),
    labKept: v.union(v.id("clinics"), v.null()),
  }),
  handler: async (ctx) => {
    console.log("🧹 Starting cleanup of duplicate system clinics...");

    // 1. Trova TUTTE le cliniche HQ
    const allHQ = await ctx.db
      .query("clinics")
      .filter((q) => q.eq(q.field("code"), "HQ"))
      .collect();

    let hqRemoved = 0;
    let hqKept = null;
    
    if (allHQ.length > 1) {
      console.log(`⚠️ Found ${allHQ.length} HQ clinics, keeping first one`);
      hqKept = allHQ[0]._id;
      
      // Cancella tutte tranne la prima
      for (let i = 1; i < allHQ.length; i++) {
        await ctx.db.delete(allHQ[i]._id);
        hqRemoved++;
        console.log(`🗑️ Deleted duplicate HQ clinic: ${allHQ[i]._id}`);
      }
    } else if (allHQ.length === 1) {
      hqKept = allHQ[0]._id;
      console.log(`✅ HQ clinic already unique: ${hqKept}`);
    }

    // 2. Trova TUTTE le cliniche LABORATORIO
    const allLab = await ctx.db
      .query("clinics")
      .filter((q) => q.eq(q.field("code"), "LABORATORIO"))
      .collect();

    let labRemoved = 0;
    let labKept = null;
    
    if (allLab.length > 1) {
      console.log(`⚠️ Found ${allLab.length} LABORATORIO clinics, keeping first one`);
      labKept = allLab[0]._id;
      
      // Cancella tutte tranne la prima
      for (let i = 1; i < allLab.length; i++) {
        await ctx.db.delete(allLab[i]._id);
        labRemoved++;
        console.log(`🗑️ Deleted duplicate LABORATORIO clinic: ${allLab[i]._id}`);
      }
    } else if (allLab.length === 1) {
      labKept = allLab[0]._id;
      console.log(`✅ LABORATORIO clinic already unique: ${labKept}`);
    }

    console.log(`✅ Cleanup completed: ${hqRemoved} HQ + ${labRemoved} LAB removed`);

    return {
      hqRemoved,
      labRemoved,
      hqKept,
      labKept,
    };
  },
});

