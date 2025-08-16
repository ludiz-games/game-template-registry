### Architecture and Data Model

#### System Overview

- **Apps/Services**
  - **Web app**: Chat, file explorer, preview, click-to-edit, tools. Next.js + AI SDK.
  - **Registry app**: Custom shadcn registry serving item manifests and files (JSON Schemas included). Based on [shadcn-ui/registry-template](https://github.com/shadcn-ui/registry-template).
  - **Colyseus server**: Real-time rooms corresponding to blueprints (e.g., Multi‑Quiz).
  - **DB**: Postgres (Supabase) with pgvector for vector search; Supabase Realtime for live updates; Supabase Storage for assets.
  - **Auth**: Better Auth.
  - **Orchestrator**: AI SDK 5 in the Next.js API routes; Postgres (Supabase) provides persistence, vectors, and realtime.

#### Deployment Topology (recommended)

- **Next.js** (web) → Vercel or similar.
- **Registry** → alongside web or separate app; URL provided to shadcn CLI `--registry`.
- **Colyseus** → dedicated Node runtime (Fly/Railway/Render).

#### Monorepo Layout (Option A)

- `apps/web` (existing `vibe-coding-platform`)
- `apps/registry` (registry site)
- `apps/colyseus-server` (rooms)

#### Data Model (Postgres tables)

```ts
// Pseudo-schema (map to SQL)
type User = {
  id: string;
  email: string;
  displayName?: string;
  createdAt: number;
};

// components(id uuid pk, name text, kind text, category text, description text,
// files jsonb, schema jsonb, tool jsonb, version text, tags text[], embedding vector)
type ComponentItem = {
  id: string;
  name: string;
  kind: "component";
  category: string;
  description?: string;
  files: string[];
  schema: any;
  tool: { name: string; description?: string };
  version: string;
  tags: string[];
  embedding: number[];
};

// blueprints(id uuid, name text, kind text, description text, files jsonb,
// schema jsonb, default_component_instances jsonb, colyseus jsonb, version text, tags text[], embedding vector)
type BlueprintItem = {
  id: string;
  name: string;
  kind: "blueprint";
  description?: string;
  files: string[];
  schema: any;
  defaultComponentInstances: Array<{ component: string; props: any }>;
  colyseus?: { room: string; events: string[] };
  version: string;
  tags: string[];
  embedding: number[];
};

// installed_components(id uuid, project_id uuid fk, name text, version text, tool_name text, schema jsonb)
type InstalledComponent = {
  id: string;
  projectId: string;
  name: string;
  version: string;
  toolName: string;
  schema: any;
};

// projects(id uuid, owner_id uuid fk, name text, blueprint_id uuid, sandbox_id text,
// installed_components jsonb, game_definition jsonb, theme_tokens jsonb,
// created_at timestamptz, updated_at timestamptz)
type Project = {
  id: string;
  ownerId: string;
  name: string;
  blueprintId?: string;
  sandboxId: string;
  installedComponents: InstalledComponent[];
  gameDefinition: GameDefinition;
  themeTokens: Record<string, string>;
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

- **Index**: Combine `ComponentItem` and `BlueprintItem` into a single table or two tables with pgvector indexes.
- **Embedding**: Use provider embedding model; store in Postgres `vector` columns; create `ivfflat` indexes for similarity search.

#### Auth Flows

- **Better Auth** session for web; pass `userId` into tool execution context; secure project ownership checks on APIs and tool routes.

#### Registry Adoption

- Use shadcn CLI `add` with `--registry <url>` to install items into a project sandbox. The assistant triggers this via a sandbox command tool.

#### Tool Registration Strategy

- Per project/thread, compile installed components' JSON Schemas into runtime tools. Keep the tool list in server session state and refresh when items are added/removed.
