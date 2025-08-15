import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Core user management
  users: defineTable({
    name: v.optional(v.string()),
    email: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_email", ["email"]),

  // Project management
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    userId: v.id("users"),
    outline: v.optional(v.any()), // JSON structure for project outline
    activeOutlinePath: v.optional(v.string()),
    settings: v.optional(v.any()), // Project-specific settings
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"]),

  // Registry components metadata
  components: defineTable({
    name: v.string(),
    version: v.string(),
    schema: v.any(), // JSON Schema
    toolMetadata: v.optional(v.any()),
    files: v.array(v.string()), // File paths
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_category", ["category"])
    .searchIndex("search_components", {
      searchField: "name",
      filterFields: ["category", "tags"],
    }),

  // Registry blueprints
  blueprints: defineTable({
    name: v.string(),
    version: v.string(),
    schema: v.any(), // JSON Schema
    defaultOutline: v.optional(v.any()),
    dependencies: v.optional(v.array(v.string())), // Component dependencies
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_category", ["category"])
    .searchIndex("search_blueprints", {
      searchField: "name",
      filterFields: ["category", "tags"],
    }),

  // Installed components per project
  installedComponents: defineTable({
    projectId: v.id("projects"),
    componentName: v.string(),
    componentVersion: v.string(),
    schema: v.any(), // Copied schema at install time
    toolMetadata: v.optional(v.any()),
    installedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_component", ["projectId", "componentName"]),

  // Chat threads
  threads: defineTable({
    projectId: v.id("projects"),
    title: v.optional(v.string()),
    userId: v.id("users"),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_project_updated", ["projectId", "updatedAt"]),

  // Chat messages
  messages: defineTable({
    threadId: v.id("threads"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
    content: v.optional(v.string()),
    parts: v.optional(v.array(v.any())), // AI SDK v5 parts format
    toolCalls: v.optional(v.array(v.any())),
    toolResults: v.optional(v.array(v.any())),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_thread_created", ["threadId", "createdAt"]),

  // Tool call execution logs
  toolCallLogs: defineTable({
    threadId: v.id("threads"),
    messageId: v.optional(v.id("messages")),
    toolName: v.string(),
    parameters: v.any(),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    duration: v.optional(v.number()), // milliseconds
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_thread", ["threadId"])
    .index("by_thread_created", ["threadId", "createdAt"])
    .index("by_tool_name", ["toolName"]),

  // File management
  files: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
    storageId: v.id("_storage"),
    url: v.optional(v.string()), // Cached URL
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_storage", ["storageId"]),

  // Vector embeddings for registry search
  vectorEmbeddings: defineTable({
    itemType: v.union(v.literal("component"), v.literal("blueprint")),
    itemId: v.string(), // ID of component or blueprint
    itemName: v.string(),
    content: v.string(), // The text that was embedded
    embedding: v.array(v.number()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_item", ["itemType", "itemId"])
    .index("by_item_name", ["itemName"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536, // OpenAI text-embedding-3-small
      filterFields: ["itemType", "itemName"],
    }),
});
