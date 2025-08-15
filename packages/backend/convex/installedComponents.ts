import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { betterAuthComponent } from "./auth";

// Install a component in a project
export const installComponent = mutation({
  args: {
    projectId: v.id("projects"),
    componentName: v.string(),
    componentVersion: v.string(),
    schema: v.any(),
    toolMetadata: v.optional(v.any()),
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

    // Check if component is already installed
    const existing = await ctx.db
      .query("installedComponents")
      .withIndex("by_project_component", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("componentName", args.componentName)
      )
      .first();

    if (existing) {
      // Update existing installation
      await ctx.db.patch(existing._id, {
        componentVersion: args.componentVersion,
        schema: args.schema,
        toolMetadata: args.toolMetadata,
        installedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new installation
      return await ctx.db.insert("installedComponents", {
        projectId: args.projectId,
        componentName: args.componentName,
        componentVersion: args.componentVersion,
        schema: args.schema,
        toolMetadata: args.toolMetadata,
        installedAt: Date.now(),
      });
    }
  },
});

// Get installed components for a project
export const getInstalledComponents = query({
  args: {
    projectId: v.id("projects"),
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
      .query("installedComponents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// Get specific installed component
export const getInstalledComponent = query({
  args: {
    projectId: v.id("projects"),
    componentName: v.string(),
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
      .query("installedComponents")
      .withIndex("by_project_component", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("componentName", args.componentName)
      )
      .first();
  },
});

// Uninstall a component from a project
export const uninstallComponent = mutation({
  args: {
    projectId: v.id("projects"),
    componentName: v.string(),
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

    const installedComponent = await ctx.db
      .query("installedComponents")
      .withIndex("by_project_component", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("componentName", args.componentName)
      )
      .first();

    if (!installedComponent) {
      throw new Error("Component not installed in this project");
    }

    await ctx.db.delete(installedComponent._id);
  },
});

// Update installed component metadata
export const updateInstalledComponent = mutation({
  args: {
    projectId: v.id("projects"),
    componentName: v.string(),
    componentVersion: v.optional(v.string()),
    schema: v.optional(v.any()),
    toolMetadata: v.optional(v.any()),
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

    const installedComponent = await ctx.db
      .query("installedComponents")
      .withIndex("by_project_component", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("componentName", args.componentName)
      )
      .first();

    if (!installedComponent) {
      throw new Error("Component not installed in this project");
    }

    const updates: any = {};
    if (args.componentVersion !== undefined) {
      updates.componentVersion = args.componentVersion;
    }
    if (args.schema !== undefined) {
      updates.schema = args.schema;
    }
    if (args.toolMetadata !== undefined) {
      updates.toolMetadata = args.toolMetadata;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(installedComponent._id, updates);
    }
  },
});

// Get installation history for a component across all projects
export const getComponentInstallations = query({
  args: {
    componentName: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Get user's projects
    const userProjects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", user.userId))
      .collect();

    const userProjectIds = new Set(userProjects.map((p) => p._id));

    // Find installations of this component in user's projects
    const allInstallations = await ctx.db
      .query("installedComponents")
      .collect();

    const userInstallations = allInstallations
      .filter(
        (installation) =>
          installation.componentName === args.componentName &&
          userProjectIds.has(installation.projectId)
      )
      .sort((a, b) => b.installedAt - a.installedAt);

    // Add project names
    const installationsWithProjects = [];
    for (const installation of userInstallations.slice(0, args.limit ?? 50)) {
      const project = userProjects.find(
        (p) => p._id === installation.projectId
      );
      installationsWithProjects.push({
        ...installation,
        projectName: project?.name || "Unknown Project",
      });
    }

    return installationsWithProjects;
  },
});

// Batch install multiple components
export const batchInstallComponents = mutation({
  args: {
    projectId: v.id("projects"),
    components: v.array(
      v.object({
        componentName: v.string(),
        componentVersion: v.string(),
        schema: v.any(),
        toolMetadata: v.optional(v.any()),
      })
    ),
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

    const results = [];

    for (const component of args.components) {
      try {
        const installationId = await installComponent(ctx, {
          projectId: args.projectId,
          componentName: component.componentName,
          componentVersion: component.componentVersion,
          schema: component.schema,
          toolMetadata: component.toolMetadata,
        });

        results.push({
          componentName: component.componentName,
          status: "success",
          installationId,
        });
      } catch (error) {
        results.push({
          componentName: component.componentName,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  },
});

// Get component usage statistics
export const getComponentUsageStats = query({
  args: {
    componentName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await betterAuthComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Get user's projects
    const userProjects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", user.userId))
      .collect();

    const userProjectIds = new Set(userProjects.map((p) => p._id));

    // Get all user's installations
    const allInstallations = await ctx.db
      .query("installedComponents")
      .collect();

    const userInstallations = allInstallations.filter((installation) =>
      userProjectIds.has(installation.projectId)
    );

    if (args.componentName) {
      // Stats for specific component
      const componentInstallations = userInstallations.filter(
        (installation) => installation.componentName === args.componentName
      );

      const versions = componentInstallations.reduce(
        (acc, installation) => {
          acc[installation.componentVersion] =
            (acc[installation.componentVersion] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        componentName: args.componentName,
        totalInstallations: componentInstallations.length,
        uniqueProjects: new Set(componentInstallations.map((i) => i.projectId))
          .size,
        versions,
        firstInstalled: Math.min(
          ...componentInstallations.map((i) => i.installedAt)
        ),
        lastInstalled: Math.max(
          ...componentInstallations.map((i) => i.installedAt)
        ),
      };
    } else {
      // Overall stats
      const componentCounts = userInstallations.reduce(
        (acc, installation) => {
          acc[installation.componentName] =
            (acc[installation.componentName] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const versionCounts = userInstallations.reduce(
        (acc, installation) => {
          const key = `${installation.componentName}@${installation.componentVersion}`;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        totalInstallations: userInstallations.length,
        uniqueComponents: Object.keys(componentCounts).length,
        componentCounts,
        versionCounts,
        mostUsedComponent: Object.entries(componentCounts).sort(
          ([, a], [, b]) => b - a
        )[0]?.[0],
        averageInstallationsPerProject:
          userProjects.length > 0
            ? userInstallations.length / userProjects.length
            : 0,
      };
    }
  },
});
