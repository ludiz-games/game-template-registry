### Comprehensive Project TODO

- **Preflight**
  - [x] Confirm stack: Next.js + AI SDK 5 (orchestrator), Supabase (Postgres + Realtime + Storage + pgvector), Better Auth, Colyseus host, image providers.
  - [ ] Create envs: LLM/embeddings, image gen, background removal, Supabase URL/ANON/SERVICE keys, Colyseus endpoint, MCP (optional).

- **Migration (Convex → Supabase)**
  - [x] Remove code and config
    - [x] Delete `packages/backend/convex/` (all functions/files)
    - [x] Delete `apps/vibe/convex.json`
    - [x] Remove any imports/usages of `@/lib/convexClient`, `convex/*`, `convex/values`
  - [x] Remove dependencies and scripts
    - [x] Root and package `package.json`: remove `convex`, `convex-dev`, `convex-*` deps and scripts
    - [x] Remove Convex-related env vars from `.env*`
  - [x] Replace references in code/docs
    - [x] AI route persistence now uses Postgres (see `docs/09-AI-SDK-Orchestration-with-Convex.md`)
    - [x] Storage now uses Supabase (see `docs/10-Supabase-Files-and-Storage.md`)

- **Monorepo and scaffolding**
  - [x] Structure: `apps/web`, `apps/vibe`, `apps/registry`, `apps/server`, `apps/game`, `packages/colyseus-types`, `packages/colyseus-hooks`.
  - [x] Add deps: AI SDK 5, `@supabase/supabase-js`, `pg`, `drizzle-orm` (or Kysely/Prisma), `pgvector`, shadcn CLI, Playwright, zod, json-schema types, MCP SDK (optional).
  - [x] Baseline docs reviewed (`docs/00–11`).

- **Registry (components + blueprints)**
  - [x] Scaffold `apps/registry` from template: [shadcn-ui/registry-template](https://github.com/shadcn-ui/registry-template).
  - [x] Components: `mcq-component`, `true-false-component`, `quiz-timer` (JSON Schema + minimal styling).
  - [ ] Blueprints: `multi-quiz` (with default `outline`), base `point-and-click`, base `youre-the-hero`.
  - [x] Manifests: `registry.json`, per-item `schema`, `tool` metadata, `files`.
  - [x] Serve items under `public/r/[name].json`; verify `shadcn add` locally.
  - [x] Make `colyseus.machine` (XState JSON) a required field on blueprint manifests (machine-first design).

- **Sandbox install loop**
  - [ ] Command tool: run `npx shadcn add <item> --registry <url>` in sandbox.
  - [ ] Persist install: `installed_components` row in Postgres (copy schema/tool metadata).

- **Database (Supabase/Postgres)**
  - [ ] Provision
    - [ ] Create Supabase project; set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
    - [ ] Create buckets: `assets`, `screens` (decide public vs private)
    - [ ] Enable `pgvector` extension
  - [ ] Schema & migrations
    - [ ] Tables: `users`, `projects`, `components`, `blueprints`, `installed_components`, `threads`, `messages`, `tool_call_logs`, `files`
    - [ ] Vectors: add `embedding vector` columns and `ivfflat` indexes where needed
    - [ ] Add Drizzle/Prisma migrations and migration scripts
  - [ ] Security (app-layer, no RLS)
    - [ ] Keep Postgres RLS disabled; enforce authorization in API routes/middleware (Better Auth session → project membership checks)
    - [ ] Use service-role only on server routes; no direct client DB writes
    - [ ] Storage: prefer private buckets + signed URLs from server; allow public-read only for explicit public assets
  - [ ] API & access
    - [ ] Server routes for reads/writes; tool call logs (create/update)
    - [ ] Signed URL endpoint for assets when using private buckets; short-lived URLs in preview
  - [ ] Rate limiting & observability
    - [ ] Basic per-user rate limits on hot routes
    - [ ] Log errors and DB timing metrics

- **AI SDK 5 orchestration**
  - [ ] Chat route `app/api/chat/route.ts`: dynamic tools from schemas; design tools; visual self-check message injection; stream + persist to Postgres.
  - [ ] Direct tool route `app/api/tools/[toolName]/route.ts`: validate with shared Zod; execute; persist.
  - [ ] Tools for multiplayer authoring:
    - [ ] `blueprint_generate_machine`: produce XState JSON + event schemas from spec/components/outline.
    - [ ] `blueprint_generate_client_stub` (optional): minimal typed client from event schemas.
  - [ ] Persist blueprint machine/state JSON in DB and expose to preview/runtime loader.

- **Editor and preview**
  - [ ] Outline data: `Project.outline`, `activeOutlinePath` (see `docs/11-Outline-and-Navigation.md`).
  - [ ] Outline tools: set_active/create/move/delete/update/attach/detach.
  - [ ] Sidebar UI with DnD; selection syncs preview; optional URL sync.
  - [ ] Click-to-edit: `SchemaForm` from JSON Schema → direct tool route.
  - [ ] Preview renders instances for selected outline node; live updates via Supabase Realtime Broadcast channel per `draftId` (or postgres_changes on `projects`).
  - [ ] Run Colyseus host inside preview sandbox (single process, WS path `/ws`).
  - [ ] Join dynamic room `"project"` from preview; load machine/state at runtime via room `options` (no bundling).
  - [ ] On machine/version change, auto-reconnect preview to new room version.

- **Design toolchain**
  - [ ] Tools: `design_generate_image`, `design_image_from_reference`, `design_remove_background`, `design_create_nine_slice`, `design_apply_theme_tokens`, `design_screenshot_page`.
  - [ ] Visual self-check via message injection (no tool); target score ≥ 0.85.
  - [ ] Supabase Storage mode: upload buffers to a bucket; return `{ path, publicUrl or signedUrl }`.

- **Colyseus**
  - [x] Register generic dynamic room host in server: `gameServer.define("project", GenericRoom)`.
  - [x] Add definition loader utility (`apps/server/src/definition-loader.ts`) for resolving JSON definitions.
  - [x] Implement runtime machine interpreter (XState JSON + JSONLogic) and map named actions to safe effects.
  - [x] Implement runtime Schema builder from DSL (`defineTypes`) to create per-definition `State` classes (no `ext*` maps).
  - [x] Generic actions system with whitelisted operations (`setState`, `increment`, `createInstance`, etc.).
  - [x] Token templating system with Mustache for dynamic parameter resolution (`${event.sessionId}`).
  - [x] MapSchema-aware path utilities for proper Colyseus replication.
  - [ ] Validate incoming messages against JSON Schemas; reject invalid payloads.
  - [ ] Add preview host mode (Colyseus mounted on the preview server inside sandbox).
  - [x] Deprecate `FullLLMRoom`; all games now use machine-first `GenericRoom`.

- **Agentic UI testing (autopilot)**
  - [ ] Preferred: MCP (Skyvern) integration and tool registration in AI SDK run: [Skyvern MCP](https://docs.skyvern.com/integrations/mcp).
  - [ ] Fallback: local Playwright atomic `browser_*` tools + agentic loop.
  - [ ] Allowlist baseUrl; cap steps; redact logs.

- **Search and install flow (assistant)**
  - [ ] Vector search tool over registry; propose/install items.
  - [ ] Register tools; create/modify outline; generate component data; preview; run design pass; perform visual check.

- **Theming**
  - [ ] Define CSS variables/tokens; tool to apply tokens; minimal shadcn styling; allow assistant edits.

- **Versioning and migrations**
  - [ ] Store registry item versions; diff/migration flow for schema/props/outline.
  - [ ] Project migrations for blueprint updates.

- **Observability and usage**
  - [ ] Log tool calls/results; model usage; errors; audit trail.
  - [ ] Metrics: time-to-first-playable, tool success rates, visual score.

- **QA and tests**
  - [ ] Unit: JSON Schema→Zod; outline ops; DB queries and storage helpers.
  - [ ] E2E: Playwright quiz flow; visual check; MCP flow.
  - [ ] Multiplayer: two-client quiz; scoreboard consistency.

- **Deployment**
  - [ ] Web/registry → Vercel; Colyseus → Fly/Railway/Render; Supabase prod.
  - [ ] CI/CD: lint/test/build; preview deployments; secrets.

- **Documentation**
  - [ ] Polish `docs/00–11`; add examples/screenshots; quickstart; ops runbooks.
  - [x] Update Colyseus docs to machine-first dynamic rooms (`docs/05`), runtime Schemas (`docs/16`).
  - [x] Add chat scenario transcripts (`docs/17`); expand with more scenarios (install flow, design pass, branching story).

- **Acceptance (MVP)**
  - [x] **Dynamic Rooms**: Machine-driven flow runs in dynamic `"project"` room with runtime Schema ✅
  - [x] **Quiz Demo**: Two players can complete quiz with score tracking ✅
  - [x] **JSON-Driven**: All game logic defined in pure JSON (no hardcoded behavior) ✅
  - [ ] Create project → install `multi-quiz` → generate MCQs → design pass (image → element → bg remove → 9-slice → theme) → screenshot → LLM similarity ≥ 0.85 → publish preview.
