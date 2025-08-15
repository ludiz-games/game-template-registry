import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, query } from "./_generated/server";

// Ingest a component or blueprint into vector search
export const ingestRegistryItem = internalMutation({
  args: {
    itemType: v.union(v.literal("component"), v.literal("blueprint")),
    itemId: v.string(),
    itemName: v.string(),
    content: v.string(), // Description, tags, etc. combined for embedding
    embedding: v.array(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Check if embedding already exists
    const existing = await ctx.db
      .query("vectorEmbeddings")
      .withIndex("by_item", (q) =>
        q.eq("itemType", args.itemType).eq("itemId", args.itemId)
      )
      .first();

    if (existing) {
      // Update existing embedding
      await ctx.db.patch(existing._id, {
        itemName: args.itemName,
        content: args.content,
        embedding: args.embedding,
        metadata: args.metadata,
      });
      return existing._id;
    } else {
      // Create new embedding
      return await ctx.db.insert("vectorEmbeddings", {
        itemType: args.itemType,
        itemId: args.itemId,
        itemName: args.itemName,
        content: args.content,
        embedding: args.embedding,
        metadata: args.metadata,
        createdAt: Date.now(),
      });
    }
  },
});

// Generate embedding using OpenAI (action because it calls external API)
export const generateEmbedding = action({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args) => {
    // This would call OpenAI's embedding API
    // For now, return a mock embedding
    // In production, you'd use:
    // const response = await openai.embeddings.create({
    //   model: "text-embedding-3-small",
    //   input: args.text,
    // });
    // return response.data[0].embedding;

    // Mock embedding for development
    return Array(1536)
      .fill(0)
      .map(() => Math.random() - 0.5);
  },
});

// Ingest registry component with embedding generation
export const ingestComponent = action({
  args: {
    componentId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    schema: v.any(),
  },
  handler: async (ctx, args) => {
    // Combine all text content for embedding
    const textContent = [
      args.name,
      args.description || "",
      args.category || "",
      ...(args.tags || []),
      // Could also include schema field names/descriptions
      JSON.stringify(args.schema).substring(0, 1000), // Truncate schema
    ]
      .filter(Boolean)
      .join(" ");

    // Generate embedding
    const embedding = await ctx.runAction(
      internal.vectorSearch.generateEmbedding,
      {
        text: textContent,
      }
    );

    // Store embedding
    await ctx.runMutation(internal.vectorSearch.ingestRegistryItem, {
      itemType: "component",
      itemId: args.componentId,
      itemName: args.name,
      content: textContent,
      embedding,
      metadata: {
        description: args.description,
        category: args.category,
        tags: args.tags,
        schema: args.schema,
      },
    });
  },
});

// Ingest registry blueprint with embedding generation
export const ingestBlueprint = action({
  args: {
    blueprintId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    dependencies: v.optional(v.array(v.string())),
    schema: v.any(),
  },
  handler: async (ctx, args) => {
    // Combine all text content for embedding
    const textContent = [
      args.name,
      args.description || "",
      args.category || "",
      ...(args.tags || []),
      ...(args.dependencies || []),
      JSON.stringify(args.schema).substring(0, 1000), // Truncate schema
    ]
      .filter(Boolean)
      .join(" ");

    // Generate embedding
    const embedding = await ctx.runAction(
      internal.vectorSearch.generateEmbedding,
      {
        text: textContent,
      }
    );

    // Store embedding
    await ctx.runMutation(internal.vectorSearch.ingestRegistryItem, {
      itemType: "blueprint",
      itemId: args.blueprintId,
      itemName: args.name,
      content: textContent,
      embedding,
      metadata: {
        description: args.description,
        category: args.category,
        tags: args.tags,
        dependencies: args.dependencies,
        schema: args.schema,
      },
    });
  },
});

// Search registry items using vector similarity
export const searchRegistryItems = action({
  args: {
    query: v.string(),
    itemType: v.optional(
      v.union(v.literal("component"), v.literal("blueprint"))
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Generate embedding for search query
    const queryEmbedding = await ctx.runAction(
      internal.vectorSearch.generateEmbedding,
      {
        text: args.query,
      }
    );

    // Search using vector similarity
    const results = await ctx.vectorSearch("vectorEmbeddings", "by_embedding", {
      vector: queryEmbedding,
      limit: args.limit ?? 10,
      filter: (q) => {
        if (args.itemType) {
          return q.eq("itemType", args.itemType);
        }
        return undefined;
      },
    });

    return results.map((result) => ({
      _id: result._id,
      itemType: result.itemType,
      itemId: result.itemId,
      itemName: result.itemName,
      content: result.content,
      metadata: result.metadata,
      _score: result._score,
    }));
  },
});

// Get all embeddings for a specific item type (for debugging)
export const getEmbeddingsByType = query({
  args: {
    itemType: v.union(v.literal("component"), v.literal("blueprint")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vectorEmbeddings")
      .withIndex("by_item", (q) => q.eq("itemType", args.itemType))
      .take(args.limit ?? 50);
  },
});

// Delete embedding for a registry item
export const deleteEmbedding = internalMutation({
  args: {
    itemType: v.union(v.literal("component"), v.literal("blueprint")),
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    const embedding = await ctx.db
      .query("vectorEmbeddings")
      .withIndex("by_item", (q) =>
        q.eq("itemType", args.itemType).eq("itemId", args.itemId)
      )
      .first();

    if (embedding) {
      await ctx.db.delete(embedding._id);
    }
  },
});

// Batch ingest multiple registry items
export const batchIngestRegistryItems = action({
  args: {
    items: v.array(
      v.object({
        itemType: v.union(v.literal("component"), v.literal("blueprint")),
        itemId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        category: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        schema: v.any(),
        dependencies: v.optional(v.array(v.string())), // Only for blueprints
      })
    ),
  },
  handler: async (ctx, args) => {
    const results = [];

    for (const item of args.items) {
      try {
        if (item.itemType === "component") {
          await ctx.runAction(internal.vectorSearch.ingestComponent, {
            componentId: item.itemId,
            name: item.name,
            description: item.description,
            category: item.category,
            tags: item.tags,
            schema: item.schema,
          });
        } else {
          await ctx.runAction(internal.vectorSearch.ingestBlueprint, {
            blueprintId: item.itemId,
            name: item.name,
            description: item.description,
            category: item.category,
            tags: item.tags,
            dependencies: item.dependencies,
            schema: item.schema,
          });
        }
        results.push({ itemId: item.itemId, status: "success" });
      } catch (error) {
        results.push({
          itemId: item.itemId,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  },
});

// Get embedding statistics
export const getEmbeddingStats = query({
  args: {},
  handler: async (ctx) => {
    const allEmbeddings = await ctx.db.query("vectorEmbeddings").collect();

    const stats = {
      total: allEmbeddings.length,
      components: allEmbeddings.filter((e) => e.itemType === "component")
        .length,
      blueprints: allEmbeddings.filter((e) => e.itemType === "blueprint")
        .length,
      byCategory: {} as Record<string, number>,
    };

    // Count by category
    allEmbeddings.forEach((embedding) => {
      const category = embedding.metadata?.category || "uncategorized";
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    });

    return stats;
  },
});
