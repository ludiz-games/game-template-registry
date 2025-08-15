import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { betterAuthComponent } from "./auth";

// Create a tool call log entry
export const createToolCallLog = mutation({
  args: {
    threadId: v.id("threads"),
    messageId: v.optional(v.id("messages")),
    toolName: v.string(),
    parameters: v.any(),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Verify user owns the thread
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== user.userId) {
      throw new Error("Thread not found or access denied");
    }

    return await ctx.db.insert("toolCallLogs", {
      threadId: args.threadId,
      messageId: args.messageId,
      toolName: args.toolName,
      parameters: args.parameters,
      status: args.status ?? "pending",
      createdAt: Date.now(),
    });
  },
});

// Update tool call log with result
export const updateToolCallLog = mutation({
  args: {
    logId: v.id("toolCallLogs"),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const log = await ctx.db.get(args.logId);
    if (!log) {
      throw new Error("Tool call log not found");
    }

    // Verify user owns the thread
    const thread = await ctx.db.get(log.threadId);
    if (!thread || thread.userId !== user.userId) {
      throw new Error("Access denied");
    }

    const updates: any = {
      status: args.status,
    };

    if (args.result !== undefined) {
      updates.result = args.result;
    }
    if (args.error !== undefined) {
      updates.error = args.error;
    }
    if (args.duration !== undefined) {
      updates.duration = args.duration;
    }
    if (args.status === "completed" || args.status === "failed") {
      updates.completedAt = Date.now();
    }

    await ctx.db.patch(args.logId, updates);
  },
});

// Get tool call logs for a thread
export const getToolCallLogsByThread = query({
  args: {
    threadId: v.id("threads"),
    limit: v.optional(v.number()),
    toolName: v.optional(v.string()), // Filter by specific tool
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Verify user owns the thread
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== user.userId) {
      throw new Error("Thread not found or access denied");
    }

    let query = ctx.db
      .query("toolCallLogs")
      .withIndex("by_thread_created", (q) => q.eq("threadId", args.threadId));

    if (args.toolName) {
      // If filtering by tool name, we need to collect and filter
      const allLogs = await query.collect();
      const filtered = allLogs.filter((log) => log.toolName === args.toolName);
      return filtered
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, args.limit ?? 50);
    }

    return await query.order("desc").take(args.limit ?? 50);
  },
});

// Get tool call logs by tool name (for analytics)
export const getToolCallLogsByTool = query({
  args: {
    toolName: v.string(),
    limit: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Get all logs for this tool
    let logs = await ctx.db
      .query("toolCallLogs")
      .withIndex("by_tool_name", (q) => q.eq("toolName", args.toolName))
      .collect();

    // Filter by user's threads only
    const userThreads = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", user.userId))
      .collect();

    const userThreadIds = new Set(userThreads.map((t) => t._id));
    logs = logs.filter((log) => userThreadIds.has(log.threadId));

    // Filter by status if provided
    if (args.status) {
      logs = logs.filter((log) => log.status === args.status);
    }

    // Sort by creation time and limit
    return logs
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 50);
  },
});

// Get tool execution statistics
export const getToolExecutionStats = query({
  args: {
    threadId: v.optional(v.id("threads")),
    toolName: v.optional(v.string()),
    timeRange: v.optional(v.number()), // milliseconds from now
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    let logs: any[] = [];

    if (args.threadId) {
      // Verify user owns the thread
      const thread = await ctx.db.get(args.threadId);
      if (!thread || thread.userId !== user.userId) {
        throw new Error("Thread not found or access denied");
      }

      logs = await ctx.db
        .query("toolCallLogs")
        .withIndex("by_thread", (q) => q.eq("threadId", args.threadId!))
        .collect();
    } else {
      // Get logs from all user's threads
      const userThreads = await ctx.db
        .query("threads")
        .withIndex("by_user", (q) => q.eq("userId", user.userId))
        .collect();

      for (const thread of userThreads) {
        const threadLogs = await ctx.db
          .query("toolCallLogs")
          .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
          .collect();
        logs.push(...threadLogs);
      }
    }

    // Apply filters
    if (args.toolName) {
      logs = logs.filter((log) => log.toolName === args.toolName);
    }

    if (args.timeRange) {
      const cutoff = Date.now() - args.timeRange;
      logs = logs.filter((log) => log.createdAt >= cutoff);
    }

    // Calculate statistics
    const stats = {
      total: logs.length,
      pending: logs.filter((l) => l.status === "pending").length,
      running: logs.filter((l) => l.status === "running").length,
      completed: logs.filter((l) => l.status === "completed").length,
      failed: logs.filter((l) => l.status === "failed").length,
      averageDuration: 0,
      toolBreakdown: {} as Record<string, number>,
    };

    // Calculate average duration for completed calls
    const completedWithDuration = logs.filter(
      (l) => l.status === "completed" && l.duration !== undefined
    );

    if (completedWithDuration.length > 0) {
      stats.averageDuration =
        completedWithDuration.reduce(
          (sum, log) => sum + (log.duration || 0),
          0
        ) / completedWithDuration.length;
    }

    // Tool usage breakdown
    logs.forEach((log) => {
      stats.toolBreakdown[log.toolName] =
        (stats.toolBreakdown[log.toolName] || 0) + 1;
    });

    return stats;
  },
});
