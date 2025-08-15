### Architecture and Data Model

#### System Overview

- **Apps/Services**
  - **Web app**: Chat, file explorer, preview, click-to-edit, tools. Next.js + AI SDK.
  - **Registry app**: Custom shadcn registry serving item manifests and files (JSON Schemas included). Based on [shadcn-ui/registry-template](https://github.com/shadcn-ui/registry-template).
  - **Colyseus server**: Real-time rooms corresponding to blueprints (e.g., Multi‑Quiz).
  - **DB**: Convex (preferred for MVP) with vector search; Postgres + pgvector is a viable alternative later.
  - **Auth**: Better Auth.
  - **Orchestrator**: AI SDK 5 in the Next.js API routes; Convex provides persistence and vectors.

#### Deployment Topology (recommended)

- **Next.js** (web) → Vercel or similar.
- **Registry** → alongside web or separate app; URL provided to shadcn CLI `--registry`.
- **Colyseus** → dedicated Node runtime (Fly/Railway/Render).

#### Monorepo Layout (Option A)

- `apps/web` (existing `vibe-coding-platform`)
- `apps/registry` (registry site)
- `apps/colyseus-server` (rooms)

#### Data Model (Convex‑style types)

```ts
// Pseudo-types for clarity
type User = {
  id: string;
  email: string;
  displayName?: string;
  createdAt: number;
};

type ComponentItem = {
  id: string;
  name: string; // "mcq"
  kind: "component";
  category: string; // "game-block" | "ui" | ...
  description?: string;
  files: string[]; // relative paths in registry
  schema: any; // JSON Schema
  tool: { name: string; description?: string };
  version: string; // semver
  tags: string[];
  embedding: number[]; // vector for search
};

type BlueprintItem = {
  id: string;
  name: string; // "multi-quiz"
  kind: "blueprint";
  description?: string;
  files: string[];
  schema: any; // JSON Schema for top-level config
  defaultComponentInstances: Array<{ component: string; props: any }>;
  colyseus?: { room: string; events: string[] };
  version: string;
  tags: string[];
  embedding: number[];
};

type InstalledComponent = {
  id: string;
  projectId: string;
  name: string; // "mcq"
  version: string;
  toolName: string; // "create_mcq_data"
  schema: any; // copied from registry at install time
};

type Project = {
  id: string;
  ownerId: string;
  name: string;
  blueprintId?: string;
  sandboxId: string; // link to sandbox/FS workspace
  installedComponents: InstalledComponent[];
  gameDefinition: GameDefinition; // tree of instances
  themeTokens: Record<string, string>; // CSS vars
  createdAt: number;
  updatedAt: number;
};

type GameDefinition = {
  pages: Array<{
    id: string;
    path: string; // e.g., "/quiz"
    instances: ComponentInstance[];
  }>;
};

type ComponentInstance = {
  id: string; // stable for click-to-edit
  name: string; // component name
  props: Record<string, any>;
};

type Thread = {
  id: string;
  userId: string;
  projectId: string;
  title?: string;
  createdAt: number;
};

type Message = {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCall?: { name: string; args: any; result?: any };
  createdAt: number;
};
```

#### Vector Search

- **Index**: Combine `ComponentItem` and `BlueprintItem` into a single vector index keyed by tags/name/description/manifests.
- **Embedding**: Use provider embedding model; store in Convex vector table; similarity search for assistant queries.

#### Auth Flows

- **Better Auth** session for web; pass `userId` into tool execution context; secure project ownership checks on APIs and tool routes.

#### Registry Adoption

- Use shadcn CLI `add` with `--registry <url>` to install items into a project sandbox. The assistant triggers this via a sandbox command tool.

#### Tool Registration Strategy

- Per project/thread, compile installed components' JSON Schemas into runtime tools. Keep the tool list in server session state and refresh when items are added/removed.
