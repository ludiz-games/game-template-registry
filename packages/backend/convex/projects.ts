import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { betterAuthComponent } from "./auth";

// Create a new project
export const createProject = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    outline: v.optional(v.any()),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    return await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      userId: user.userId,
      outline: args.outline,
      activeOutlinePath: undefined,
      settings: args.settings,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Get projects for current user
export const getProjectsByUser = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    return await ctx.db
      .query("projects")
      .withIndex("by_user_created", (q) => q.eq("userId", user.userId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// Get a specific project
export const getProject = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    if (project.userId !== user.userId) {
      throw new Error("Access denied");
    }

    return project;
  },
});

// Update project
export const updateProject = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    outline: v.optional(v.any()),
    activeOutlinePath: v.optional(v.string()),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user.userId) {
      throw new Error("Project not found or access denied");
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.description !== undefined) {
      updates.description = args.description;
    }
    if (args.outline !== undefined) {
      updates.outline = args.outline;
    }
    if (args.activeOutlinePath !== undefined) {
      updates.activeOutlinePath = args.activeOutlinePath;
    }
    if (args.settings !== undefined) {
      updates.settings = args.settings;
    }

    await ctx.db.patch(args.projectId, updates);
  },
});

// Delete project (and all related data)
export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user.userId) {
      throw new Error("Project not found or access denied");
    }

    // Delete all threads in the project
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const thread of threads) {
      // Delete messages in each thread
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }

      // Delete tool call logs in each thread
      const toolCallLogs = await ctx.db
        .query("toolCallLogs")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect();

      for (const log of toolCallLogs) {
        await ctx.db.delete(log._id);
      }

      // Delete the thread
      await ctx.db.delete(thread._id);
    }

    // Delete installed components
    const installedComponents = await ctx.db
      .query("installedComponents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const component of installedComponents) {
      await ctx.db.delete(component._id);
    }

    // Delete files
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const file of files) {
      // Delete from storage
      try {
        await ctx.storage.delete(file.storageId);
      } catch {
        // File might already be deleted, continue
      }
      // Delete from database
      await ctx.db.delete(file._id);
    }

    // Finally, delete the project
    await ctx.db.delete(args.projectId);
  },
});

// Get project statistics
export const getProjectStats = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user.userId) {
      throw new Error("Project not found or access denied");
    }

    // Count threads
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Count messages across all threads
    let totalMessages = 0;
    for (const thread of threads) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect();
      totalMessages += messages.length;
    }

    // Count installed components
    const installedComponents = await ctx.db
      .query("installedComponents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Count files
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const totalFileSize = files.reduce((sum, file) => sum + file.size, 0);

    // Count tool calls across all threads
    let totalToolCalls = 0;
    for (const thread of threads) {
      const toolCalls = await ctx.db
        .query("toolCallLogs")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect();
      totalToolCalls += toolCalls.length;
    }

    return {
      project: {
        id: project._id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      threads: threads.length,
      messages: totalMessages,
      installedComponents: installedComponents.length,
      files: files.length,
      totalFileSize,
      toolCalls: totalToolCalls,
      hasOutline: !!project.outline,
      activeOutlinePath: project.activeOutlinePath,
    };
  },
});

// Get recent activity across all user's projects
export const getRecentActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Get user's projects
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", user.userId))
      .collect();

    const activities = [];

    // Get recent threads
    for (const project of projects) {
      const recentThreads = await ctx.db
        .query("threads")
        .withIndex("by_project_updated", (q) => q.eq("projectId", project._id))
        .order("desc")
        .take(5);

      for (const thread of recentThreads) {
        activities.push({
          type: "thread_updated",
          projectId: project._id,
          projectName: project.name,
          threadId: thread._id,
          threadTitle: thread.title,
          timestamp: thread.updatedAt,
        });
      }
    }

    // Sort all activities by timestamp and limit
    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, args.limit ?? 20);
  },
});
