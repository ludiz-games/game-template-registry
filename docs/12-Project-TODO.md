### Comprehensive Project TODO

- **Preflight**
  - [x] Confirm stack: Next.js + AI SDK 5 (orchestrator), Supabase (Postgres + Realtime + Storage + pgvector), Better Auth, Colyseus host, image providers.
  - [ ] Create envs: LLM/embeddings, image gen, background removal, Supabase URL/ANON/SERVICE keys, Colyseus endpoint, MCP (optional).

- **Migration (Convex → Supabase)**
  - [ ] Remove code and config
    - [ ] Delete `packages/backend/convex/` (all functions/files)
    - [ ] Delete `apps/vibe/convex.json`
    - [ ] Remove any imports/usages of `@/lib/convexClient`, `convex/*`, `convex/values`
  - [ ] Remove dependencies and scripts
    - [ ] Root and package `package.json`: remove `convex`, `convex-dev`, `convex-*` deps and scripts
    - [ ] Remove Convex-related env vars from `.env*`
  - [ ] Replace references in code/docs
    - [ ] AI route persistence now uses Postgres (see `docs/09-AI-SDK-Orchestration-with-Convex.md`)
    - [ ] Storage now uses Supabase (see `docs/10-Supabase-Files-and-Storage.md`)

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
  - [ ] RLS & security
    - [ ] Enable RLS and write policies (owner can read/write own projects/threads/messages/files)
    - [ ] Storage policies for buckets (owner-only or public-read as needed)
  - [ ] API & access
    - [ ] Server routes for reads/writes; tool call logs (create/update)
    - [ ] Signed URL endpoint for assets when using private buckets
  - [ ] Rate limiting & observability
    - [ ] Basic per-user rate limits on hot routes
    - [ ] Log errors and DB timing metrics

- **AI SDK 5 orchestration**
  - [ ] Chat route `app/api/chat/route.ts`: dynamic tools from schemas; design tools; visual self-check message injection; stream + persist to Postgres.
  - [ ] Direct tool route `app/api/tools/[toolName]/route.ts`: validate with shared Zod; execute; persist.

- **Editor and preview**
  - [ ] Outline data: `Project.outline`, `activeOutlinePath` (see `docs/11-Outline-and-Navigation.md`).
  - [ ] Outline tools: set_active/create/move/delete/update/attach/detach.
  - [ ] Sidebar UI with DnD; selection syncs preview; optional URL sync.
  - [ ] Click-to-edit: `SchemaForm` from JSON Schema → direct tool route.
  - [ ] Preview renders instances for selected outline node; live updates via Supabase Realtime Broadcast channel per `draftId` (or postgres_changes on `projects`).

- **Design toolchain**
  - [ ] Tools: `design_generate_image`, `design_image_from_reference`, `design_remove_background`, `design_create_nine_slice`, `design_apply_theme_tokens`, `design_screenshot_page`.
  - [ ] Visual self-check via message injection (no tool); target score ≥ 0.85.
  - [ ] Supabase Storage mode: upload buffers to a bucket; return `{ path, publicUrl or signedUrl }`.

- **Colyseus**
  - [x] Server: `FullLLMRoom` (join/submit/next/score); ready for deploy (Fly/Railway/Render).
  - [x] Client wrapper: `@ludiz/colyseus-hooks` package; blueprint wiring; env-based endpoint.
  - [ ] Optionally sync `activeNodePath` for multiplayer progression.

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

- **Acceptance (MVP)**
  - [ ] Create project → install `multi-quiz` → generate MCQs → outline navigates steps → two players complete quiz → design pass (image → element → bg remove → 9-slice → theme) → screenshot → LLM similarity ≥ 0.85 → publish preview.
