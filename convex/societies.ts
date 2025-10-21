import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/utils";

// Create a new society
export const createSociety = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Require authenticated user
    const { user } = await requireUser(ctx);

    // Check if society code already exists
    if (!args.code) {
      throw new Error("Society code is required");
    }
    const existingSociety = await ctx.db
      .query("societies")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existingSociety) {
      throw new Error("Society code already exists");
    }

    // Create society with createdBy
    const societyId = await ctx.db.insert("societies", {
      name: args.name,
      code: args.code,
      description: args.description,
      isActive: true,
      createdAt: Date.now(),
      createdBy: user._id,
    });

    // Log the creation
    await ctx.db.insert("auditLogs", {
      entityType: "society",
      entityId: societyId,
      action: "create",
      userId: user._id,
      changes: {
        name: args.name,
        code: args.code,
        description: args.description || "",
      },
    });

    return societyId;
  },
});

// Get all societies
export const getAllSocieties = query({
  args: {
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const societies = await ctx.db
      .query("societies")
      .withIndex("by_active", (q) => 
        args.activeOnly !== false ? q.eq("isActive", true) : q
      )
      .collect();

    return societies;
  },
});

// Get society by ID
export const getSocietyById = query({
  args: {
    societyId: v.id("societies"),
  },
  handler: async (ctx, args) => {
    const society = await ctx.db.get(args.societyId);
    return society;
  },
});

// Update society
export const updateSociety = mutation({
  args: {
    societyId: v.id("societies"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Require authenticated user
    const { user } = await requireUser(ctx);

    const existingSociety = await ctx.db.get(args.societyId);
    if (!existingSociety) {
      throw new Error("Society not found");
    }

    // Check if new code already exists (if code is being changed)
    if (args.code && args.code !== existingSociety.code) {
      const newCode = args.code;
      if (!newCode) {
        throw new Error("Society code is required");
      }
      const codeExists = await ctx.db
        .query("societies")
        .withIndex("by_code", (q) => q.eq("code", newCode))
        .first();

      if (codeExists) {
        throw new Error("Society code already exists");
      }
    }

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.code !== undefined) updates.code = args.code;
    if (args.description !== undefined) updates.description = args.description;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    await ctx.db.patch(args.societyId, updates);

    // Log the update
    await ctx.db.insert("auditLogs", {
      entityType: "society",
      entityId: args.societyId,
      action: "update",
      userId: user._id,
      changes: {
        old: existingSociety,
        new: updates,
      },
    });

    return args.societyId;
  },
});

// Delete society (soft delete by setting isActive to false)
export const deleteSociety = mutation({
  args: {
    societyId: v.id("societies"),
  },
  handler: async (ctx, args) => {
    // Require authenticated user
    const { user } = await requireUser(ctx);

    const existingSociety = await ctx.db.get(args.societyId);
    if (!existingSociety) {
      throw new Error("Society not found");
    }

    await ctx.db.patch(args.societyId, { isActive: false });

    // Log the deletion
    await ctx.db.insert("auditLogs", {
      entityType: "society",
      entityId: args.societyId,
      action: "delete",
      userId: user._id,
      changes: {
        old: existingSociety,
      },
    });

    return args.societyId;
  },
});

// Assign society to user
export const assignSocietyToUser = mutation({
  args: {
    userId: v.id("users"),
    societyId: v.id("societies"),
  },
  handler: async (ctx, args) => {
    // Require authenticated user
    const { user } = await requireUser(ctx);

    // Check if society exists and is active
    const society = await ctx.db.get(args.societyId);
    if (!society || !society.isActive) {
      throw new Error("Society not found or inactive");
    }

    // Check if assignment already exists
    const existingAssignment = await ctx.db
      .query("userSocieties")
      .withIndex("by_user_society", (q) => 
        q.eq("userId", args.userId).eq("societyId", args.societyId)
      )
      .first();

    if (existingAssignment) {
      // Reactivate if it was inactive
      if (!existingAssignment.isActive) {
        await ctx.db.patch(existingAssignment._id, {
          isActive: true,
          assignedBy: user._id,
          assignedAt: Date.now(),
        });
      }
      return existingAssignment._id;
    }

    // Create new assignment
    const assignmentId = await ctx.db.insert("userSocieties", {
      userId: args.userId,
      societyId: args.societyId,
      assignedBy: user._id,
      assignedAt: Date.now(),
      isActive: true,
    });

    // Log the assignment
    await ctx.db.insert("auditLogs", {
      entityType: "userSociety",
      entityId: assignmentId,
      action: "create",
      userId: user._id,
      changes: {
        userId: args.userId,
        societyId: args.societyId,
      },
    });

    return assignmentId;
  },
});

// Remove society from user
export const removeSocietyFromUser = mutation({
  args: {
    userId: v.id("users"),
    societyId: v.id("societies"),
  },
  handler: async (ctx, args) => {
    // Require authenticated user
    const { user } = await requireUser(ctx);

    const existingAssignment = await ctx.db
      .query("userSocieties")
      .withIndex("by_user_society", (q) => 
        q.eq("userId", args.userId).eq("societyId", args.societyId)
      )
      .first();

    if (!existingAssignment) {
      throw new Error("Assignment not found");
    }

    await ctx.db.patch(existingAssignment._id, { isActive: false });

    // Log the removal
    await ctx.db.insert("auditLogs", {
      entityType: "userSociety",
      entityId: existingAssignment._id,
      action: "delete",
      userId: user._id,
      changes: {
        userId: args.userId,
        societyId: args.societyId,
      },
    });

    return existingAssignment._id;
  },
});

// Get user societies
export const getUserSocieties = query({
  args: {
    userId: v.id("users"),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("userSocieties")
      .withIndex("by_user", (q) => 
        q.eq("userId", args.userId)
      );

    if (args.activeOnly !== false) {
      query = query.filter((q) => q.eq(q.field("isActive"), true));
    }

    const userSocieties = await query.collect();

    const societies = await Promise.all(
      userSocieties.map(async (userSociety) => {
        const society = await ctx.db.get(userSociety.societyId);
        return society ? {
          ...society,
          assignmentId: userSociety._id,
          assignedAt: userSociety.assignedAt,
          assignedBy: userSociety.assignedBy,
        } : null;
      })
    );

    return societies.filter(Boolean);
  },
});

// Get users in society
export const getSocietyUsers = query({
  args: {
    societyId: v.id("societies"),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("userSocieties")
      .withIndex("by_society", (q) => 
        q.eq("societyId", args.societyId)
      );

    if (args.activeOnly !== false) {
      query = query.filter((q) => q.eq(q.field("isActive"), true));
    }

    const userSocieties = await query.collect();

    const users = await Promise.all(
      userSocieties.map(async (userSociety) => {
        const user = await ctx.db.get(userSociety.userId);
        return user ? {
          ...user,
          assignmentId: userSociety._id,
          assignedAt: userSociety.assignedAt,
          assignedBy: userSociety.assignedBy,
        } : null;
      })
    );

    return users.filter(Boolean);
  },
});

// Check if user has access to society
export const hasUserSocietyAccess = query({
  args: {
    userId: v.id("users"),
    societyId: v.id("societies"),
  },
  handler: async (ctx, args) => {
    const userSociety = await ctx.db
      .query("userSocieties")
      .withIndex("by_user_society", (q) => 
        q.eq("userId", args.userId).eq("societyId", args.societyId)
      )
      .first();

    return userSociety?.isActive ?? false;
  },
});
