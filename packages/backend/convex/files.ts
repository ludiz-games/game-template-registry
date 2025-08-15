import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { betterAuthComponent } from "./auth";

// Generate upload URL for file storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Generate upload URL using Convex's built-in file storage
    return await ctx.storage.generateUploadUrl();
  },
});

// Record uploaded file in database
export const recordUpload = mutation({
  args: {
    projectId: v.id("projects"),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
    storageId: v.id("_storage"),
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

    // Verify the file was actually uploaded
    const fileExists = await ctx.storage.getUrl(args.storageId);
    if (!fileExists) {
      throw new Error("File not found in storage");
    }

    // Record file in database
    const fileId = await ctx.db.insert("files", {
      projectId: args.projectId,
      userId: user.userId,
      filename: args.filename,
      contentType: args.contentType,
      size: args.size,
      storageId: args.storageId,
      metadata: args.metadata,
      createdAt: Date.now(),
    });

    return fileId;
  },
});

// Get file URL (with caching)
export const getFileUrl = mutation({
  args: {
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Verify user has access (owns project or file)
    if (file.userId !== user.userId) {
      const project = await ctx.db.get(file.projectId);
      if (!project || project.userId !== user.userId) {
        throw new Error("Access denied");
      }
    }

    // Get URL from storage
    const url = await ctx.storage.getUrl(file.storageId);
    if (!url) {
      throw new Error("File not found in storage");
    }

    // Cache URL in database for faster access
    if (file.url !== url) {
      await ctx.db.patch(args.fileId, { url });
    }

    return url;
  },
});

// Get files for a project
export const getFilesByProject = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
    contentType: v.optional(v.string()), // Filter by content type
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

    let files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .take(args.limit ?? 100);

    // Filter by content type if specified
    if (args.contentType) {
      files = files.filter((file) =>
        file.contentType.startsWith(args.contentType)
      );
    }

    return files.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get files by user
export const getFilesByUser = query({
  args: {
    limit: v.optional(v.number()),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    let files = await ctx.db
      .query("files")
      .withIndex("by_user", (q) => q.eq("userId", user.userId))
      .take(args.limit ?? 100);

    // Filter by content type if specified
    if (args.contentType) {
      files = files.filter((file) =>
        file.contentType.startsWith(args.contentType)
      );
    }

    return files.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get file metadata
export const getFile = query({
  args: {
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Verify user has access
    if (file.userId !== user.userId) {
      const project = await ctx.db.get(file.projectId);
      if (!project || project.userId !== user.userId) {
        throw new Error("Access denied");
      }
    }

    return file;
  },
});

// Delete file
export const deleteFile = mutation({
  args: {
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Verify user has access
    if (file.userId !== user.userId) {
      const project = await ctx.db.get(file.projectId);
      if (!project || project.userId !== user.userId) {
        throw new Error("Access denied");
      }
    }

    // Delete from storage
    await ctx.storage.delete(file.storageId);

    // Delete from database
    await ctx.db.delete(args.fileId);
  },
});

// Update file metadata
export const updateFileMetadata = mutation({
  args: {
    fileId: v.id("files"),
    filename: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Verify user has access
    if (file.userId !== user.userId) {
      const project = await ctx.db.get(file.projectId);
      if (!project || project.userId !== user.userId) {
        throw new Error("Access denied");
      }
    }

    const updates: any = {};
    if (args.filename !== undefined) {
      updates.filename = args.filename;
    }
    if (args.metadata !== undefined) {
      updates.metadata = args.metadata;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.fileId, updates);
    }
  },
});

// Get file storage statistics
export const getFileStats = query({
  args: {
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    let files;

    if (args.projectId) {
      // Verify user owns the project
      const project = await ctx.db.get(args.projectId);
      if (!project || project.userId !== user.userId) {
        throw new Error("Project not found or access denied");
      }

      files = await ctx.db
        .query("files")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
    } else {
      // Get all user's files
      files = await ctx.db
        .query("files")
        .withIndex("by_user", (q) => q.eq("userId", user.userId))
        .collect();
    }

    const stats = {
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      byContentType: {} as Record<string, { count: number; size: number }>,
      averageSize: 0,
      oldestFile: null as any,
      newestFile: null as any,
    };

    if (files.length > 0) {
      stats.averageSize = stats.totalSize / files.length;

      // Sort by creation time
      const sortedFiles = files.sort((a, b) => a.createdAt - b.createdAt);
      stats.oldestFile = sortedFiles[0];
      stats.newestFile = sortedFiles[sortedFiles.length - 1];

      // Group by content type
      files.forEach((file) => {
        const contentType = file.contentType.split("/")[0]; // e.g., 'image' from 'image/png'
        if (!stats.byContentType[contentType]) {
          stats.byContentType[contentType] = { count: 0, size: 0 };
        }
        stats.byContentType[contentType].count++;
        stats.byContentType[contentType].size += file.size;
      });
    }

    return stats;
  },
});

// Clean up orphaned files (files without valid storage)
export const cleanupOrphanedFiles = mutation({
  args: {
    projectId: v.optional(v.id("projects")),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    let files;

    if (args.projectId) {
      // Verify user owns the project
      const project = await ctx.db.get(args.projectId);
      if (!project || project.userId !== user.userId) {
        throw new Error("Project not found or access denied");
      }

      files = await ctx.db
        .query("files")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
    } else {
      // Get all user's files
      files = await ctx.db
        .query("files")
        .withIndex("by_user", (q) => q.eq("userId", user.userId))
        .collect();
    }

    const orphanedFiles = [];

    // Check each file to see if it exists in storage
    for (const file of files) {
      try {
        const url = await ctx.storage.getUrl(file.storageId);
        if (!url) {
          orphanedFiles.push(file);
        }
      } catch {
        orphanedFiles.push(file);
      }
    }

    if (!args.dryRun) {
      // Actually delete orphaned files from database
      for (const file of orphanedFiles) {
        await ctx.db.delete(file._id);
      }
    }

    return {
      totalFiles: files.length,
      orphanedFiles: orphanedFiles.length,
      cleanedUp: !args.dryRun,
      orphanedFileIds: orphanedFiles.map((f) => f._id),
    };
  },
});
