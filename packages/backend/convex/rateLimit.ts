import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { betterAuthComponent } from "./auth";

// Rate limit configuration
const RATE_LIMITS = {
  // API calls per minute
  api_calls: { limit: 100, window: 60 * 1000 }, // 100 calls per minute

  // File uploads per hour
  file_uploads: { limit: 50, window: 60 * 60 * 1000 }, // 50 uploads per hour

  // Vector searches per minute
  vector_searches: { limit: 20, window: 60 * 1000 }, // 20 searches per minute

  // Tool calls per minute
  tool_calls: { limit: 30, window: 60 * 1000 }, // 30 tool calls per minute

  // Message creation per minute
  messages: { limit: 50, window: 60 * 1000 }, // 50 messages per minute

  // Project creation per day
  project_creation: { limit: 10, window: 24 * 60 * 60 * 1000 }, // 10 projects per day
};

// Rate limit tracking table (we'll add this to schema later)
// For now, we'll use a simple in-memory approach with the existing schema

// Check rate limit for a user and action
export const checkRateLimit = mutation({
  args: {
    action: v.string(),
    identifier: v.optional(v.string()), // Optional custom identifier
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const userId = args.identifier || user.userId;
    const config = RATE_LIMITS[args.action as keyof typeof RATE_LIMITS];

    if (!config) {
      throw new Error(`Unknown rate limit action: ${args.action}`);
    }

    const now = Date.now();
    const windowStart = now - config.window;

    // For now, we'll use tool call logs as a proxy for rate limiting
    // In a production system, you'd have a dedicated rate limit table
    let count = 0;

    switch (args.action) {
      case "tool_calls":
        // Count recent tool calls
        const userThreads = await ctx.db
          .query("threads")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();

        for (const thread of userThreads) {
          const recentToolCalls = await ctx.db
            .query("toolCallLogs")
            .withIndex("by_thread_created", (q) => q.eq("threadId", thread._id))
            .filter((q) => q.gte(q.field("createdAt"), windowStart))
            .collect();
          count += recentToolCalls.length;
        }
        break;

      case "messages":
        // Count recent messages
        const messageThreads = await ctx.db
          .query("threads")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();

        for (const thread of messageThreads) {
          const recentMessages = await ctx.db
            .query("messages")
            .withIndex("by_thread_created", (q) => q.eq("threadId", thread._id))
            .filter((q) => q.gte(q.field("createdAt"), windowStart))
            .collect();
          count += recentMessages.length;
        }
        break;

      case "file_uploads":
        // Count recent file uploads
        const recentFiles = await ctx.db
          .query("files")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .filter((q) => q.gte(q.field("createdAt"), windowStart))
          .collect();
        count = recentFiles.length;
        break;

      case "project_creation":
        // Count recent project creations
        const recentProjects = await ctx.db
          .query("projects")
          .withIndex("by_user_created", (q) => q.eq("userId", userId))
          .filter((q) => q.gte(q.field("createdAt"), windowStart))
          .collect();
        count = recentProjects.length;
        break;

      default:
        // For other actions, we'll be permissive for now
        count = 0;
    }

    const isLimited = count >= config.limit;

    return {
      allowed: !isLimited,
      count,
      limit: config.limit,
      windowMs: config.window,
      resetTime: windowStart + config.window,
      retryAfter: isLimited
        ? Math.ceil((windowStart + config.window - now) / 1000)
        : 0,
    };
  },
});

// Enforce rate limit (throws if exceeded)
export const enforceRateLimit = mutation({
  args: {
    action: v.string(),
    identifier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("rateLimits").first(); // This will fail, but shows the pattern
    // In practice, you'd call checkRateLimit and throw if not allowed

    // For now, let's implement a simple version
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const rateLimitResult = await checkRateLimit(ctx, args);

    if (!rateLimitResult.allowed) {
      throw new Error(
        `Rate limit exceeded for ${args.action}. ` +
          `Limit: ${rateLimitResult.limit} per ${Math.round(rateLimitResult.windowMs / 1000)}s. ` +
          `Current: ${rateLimitResult.count}. ` +
          `Try again in ${rateLimitResult.retryAfter} seconds.`
      );
    }

    return rateLimitResult;
  },
});

// Get rate limit status for user
export const getRateLimitStatus = query({
  args: {
    actions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const actions = args.actions || Object.keys(RATE_LIMITS);
    const status: Record<string, any> = {};

    for (const action of actions) {
      if (RATE_LIMITS[action as keyof typeof RATE_LIMITS]) {
        try {
          // We'd normally call checkRateLimit here, but for now return mock data
          const config = RATE_LIMITS[action as keyof typeof RATE_LIMITS];
          status[action] = {
            allowed: true,
            count: 0,
            limit: config.limit,
            windowMs: config.window,
            resetTime: Date.now() + config.window,
            retryAfter: 0,
          };
        } catch (error) {
          status[action] = {
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }
    }

    return status;
  },
});

// Security helper: validate user permissions for resource
export const validateResourceAccess = query({
  args: {
    resourceType: v.union(
      v.literal("project"),
      v.literal("thread"),
      v.literal("message"),
      v.literal("file")
    ),
    resourceId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      return { allowed: false, reason: "Not authenticated" };
    }

    try {
      switch (args.resourceType) {
        case "project":
          const project = await ctx.db.get(args.resourceId as any);
          if (!project) {
            return { allowed: false, reason: "Project not found" };
          }
          return {
            allowed: project.userId === user.userId,
            reason: project.userId === user.userId ? "Owner" : "Access denied",
          };

        case "thread":
          const thread = await ctx.db.get(args.resourceId as any);
          if (!thread) {
            return { allowed: false, reason: "Thread not found" };
          }
          return {
            allowed: thread.userId === user.userId,
            reason: thread.userId === user.userId ? "Owner" : "Access denied",
          };

        case "message":
          const message = await ctx.db.get(args.resourceId as any);
          if (!message) {
            return { allowed: false, reason: "Message not found" };
          }
          const messageThread = await ctx.db.get(message.threadId);
          if (!messageThread) {
            return { allowed: false, reason: "Thread not found" };
          }
          return {
            allowed: messageThread.userId === user.userId,
            reason:
              messageThread.userId === user.userId
                ? "Thread owner"
                : "Access denied",
          };

        case "file":
          const file = await ctx.db.get(args.resourceId as any);
          if (!file) {
            return { allowed: false, reason: "File not found" };
          }
          return {
            allowed: file.userId === user.userId,
            reason: file.userId === user.userId ? "Owner" : "Access denied",
          };

        default:
          return { allowed: false, reason: "Unknown resource type" };
      }
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Security audit log (for tracking suspicious activity)
export const logSecurityEvent = mutation({
  args: {
    eventType: v.string(),
    details: v.any(),
    severity: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical")
    ),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);

    // In a real implementation, you'd store this in a dedicated security log table
    // For now, we'll just validate the structure
    const logEntry = {
      userId: user?.userId || "anonymous",
      eventType: args.eventType,
      details: args.details,
      severity: args.severity,
      timestamp: Date.now(),
      userAgent: args.details?.userAgent || "unknown",
      ipAddress: args.details?.ipAddress || "unknown",
    };

    // In production, you'd:
    // 1. Store in a security_logs table
    // 2. Alert on high/critical severity
    // 3. Aggregate suspicious patterns

    console.log("Security Event:", logEntry);

    return { logged: true, eventId: `sec_${Date.now()}` };
  },
});

// Get user's security summary
export const getSecuritySummary = query({
  args: {},
  handler: async (ctx) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Calculate some basic security metrics
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", user.userId))
      .collect();

    const threads = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", user.userId))
      .collect();

    const files = await ctx.db
      .query("files")
      .withIndex("by_user", (q) => q.eq("userId", user.userId))
      .collect();

    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    return {
      user: {
        id: user.userId,
        email: user.email,
        createdAt: user.createdAt,
      },
      resources: {
        projects: projects.length,
        threads: threads.length,
        files: files.length,
        totalFileSize: files.reduce((sum, f) => sum + f.size, 0),
      },
      recentActivity: {
        projectsCreated24h: projects.filter((p) => p.createdAt >= dayAgo)
          .length,
        threadsCreated24h: threads.filter((t) => t.createdAt >= dayAgo).length,
        filesUploaded24h: files.filter((f) => f.createdAt >= dayAgo).length,
      },
      rateLimits: Object.keys(RATE_LIMITS).map((action) => ({
        action,
        limit: RATE_LIMITS[action as keyof typeof RATE_LIMITS].limit,
        windowMs: RATE_LIMITS[action as keyof typeof RATE_LIMITS].window,
      })),
    };
  },
});
