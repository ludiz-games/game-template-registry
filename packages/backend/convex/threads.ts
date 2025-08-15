import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { betterAuthComponent } from "./auth";

// Create a new thread
export const createThread = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Verify user owns the project
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user.userId) {
      throw new Error("Project not found or access denied");
    }

    const now = Date.now();
    return await ctx.db.insert("threads", {
      projectId: args.projectId,
      title: args.title,
      userId: user.userId,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Get threads for a project
export const getThreadsByProject = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Verify user owns the project
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user.userId) {
      throw new Error("Project not found or access denied");
    }

    return await ctx.db
      .query("threads")
      .withIndex("by_project_updated", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// Get a specific thread
export const getThread = query({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    // Verify user owns the thread
    if (thread.userId !== user.userId) {
      throw new Error("Access denied");
    }

    return thread;
  },
});

// Update thread
export const updateThread = mutation({
  args: {
    threadId: v.id("threads"),
    title: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== user.userId) {
      throw new Error("Thread not found or access denied");
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) {
      updates.title = args.title;
    }
    if (args.metadata !== undefined) {
      updates.metadata = args.metadata;
    }

    await ctx.db.patch(args.threadId, updates);
  },
});

// Delete thread
export const deleteThread = mutation({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== user.userId) {
      throw new Error("Thread not found or access denied");
    }

    // Delete all messages in the thread
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete all tool call logs in the thread
    const toolCallLogs = await ctx.db
      .query("toolCallLogs")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    for (const log of toolCallLogs) {
      await ctx.db.delete(log._id);
    }

    // Delete the thread
    await ctx.db.delete(args.threadId);
  },
});
