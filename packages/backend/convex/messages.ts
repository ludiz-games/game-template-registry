import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { betterAuthComponent } from "./auth";

// Add a message to a thread
export const addMessage = mutation({
  args: {
    threadId: v.id("threads"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.optional(v.string()),
    parts: v.optional(v.array(v.any())), // AI SDK v5 parts format
    toolCalls: v.optional(v.array(v.any())),
    toolResults: v.optional(v.array(v.any())),
    metadata: v.optional(v.any()),
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

    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      role: args.role,
      content: args.content,
      parts: args.parts,
      toolCalls: args.toolCalls,
      toolResults: args.toolResults,
      metadata: args.metadata,
      createdAt: Date.now(),
    });

    // Update thread's updatedAt timestamp
    await ctx.db.patch(args.threadId, {
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

// Get messages for a thread
export const getMessagesByThread = query({
  args: {
    threadId: v.id("threads"),
    limit: v.optional(v.number()),
    before: v.optional(v.id("messages")), // For pagination
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
      .query("messages")
      .withIndex("by_thread_created", (q) => q.eq("threadId", args.threadId));

    if (args.before) {
      const beforeMessage = await ctx.db.get(args.before);
      if (beforeMessage) {
        query = query.filter((q) => q.lt(q.field("createdAt"), beforeMessage.createdAt));
      }
    }

    return await query
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// Get a specific message
export const getMessage = query({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Verify user owns the thread
    const thread = await ctx.db.get(message.threadId);
    if (!thread || thread.userId !== user.userId) {
      throw new Error("Access denied");
    }

    return message;
  },
});

// Update a message (mainly for tool results)
export const updateMessage = mutation({
  args: {
    messageId: v.id("messages"),
    toolResults: v.optional(v.array(v.any())),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Verify user owns the thread
    const thread = await ctx.db.get(message.threadId);
    if (!thread || thread.userId !== user.userId) {
      throw new Error("Access denied");
    }

    const updates: any = {};
    if (args.toolResults !== undefined) {
      updates.toolResults = args.toolResults;
    }
    if (args.metadata !== undefined) {
      updates.metadata = args.metadata;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.messageId, updates);
    }
  },
});

// Delete a message
export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Verify user owns the thread
    const thread = await ctx.db.get(message.threadId);
    if (!thread || thread.userId !== user.userId) {
      throw new Error("Access denied");
    }

    await ctx.db.delete(args.messageId);
  },
});

// Get recent messages across all user's threads (for context)
export const getRecentMessages = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Get user's threads
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", user.userId))
      .collect();

    const threadIds = threads.map(t => t._id);

    // Get recent messages from all threads
    const messages = [];
    for (const threadId of threadIds.slice(0, 10)) { // Limit to 10 most recent threads
      const threadMessages = await ctx.db
        .query("messages")
        .withIndex("by_thread_created", (q) => q.eq("threadId", threadId))
        .order("desc")
        .take(5); // 5 most recent per thread

      messages.push(...threadMessages);
    }

    // Sort by creation time and limit
    return messages
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 100);
  },
});
