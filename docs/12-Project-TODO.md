### Comprehensive Project TODO

- **Preflight**
  - [x] Confirm stack: Next.js + AI SDK 5 (orchestrator), Convex (state/vectors/files), Better Auth, Colyseus host, image providers.
  - [ ] Create envs: LLM/embeddings, image gen, background removal, Convex, Colyseus endpoint, MCP (optional).

- **Monorepo and scaffolding**
  - [x] Structure: `apps/web`, `apps/vibe`, `apps/registry`, `apps/server`, `apps/game`, `packages/colyseus-types`, `packages/colyseus-hooks`.
  - [x] Add deps: AI SDK 5, Convex client/server, shadcn CLI, Playwright, zod, json-schema types, MCP SDK (optional).
  - [x] Baseline docs reviewed (`docs/00–11`).

- **Registry (components + blueprints)**
  - [x] Scaffold `apps/registry` from template: [shadcn-ui/registry-template](https://github.com/shadcn-ui/registry-template).
  - [x] Components: `mcq-component`, `true-false-component`, `quiz-timer` (JSON Schema + minimal styling).
  - [ ] Blueprints: `multi-quiz` (with default `outline`), base `point-and-click`, base `youre-the-hero`.
  - [x] Manifests: `registry.json`, per-item `schema`, `tool` metadata, `files`.
  - [x] Serve items under `public/r/[name].json`; verify `shadcn add` locally.

- **Sandbox install loop**
  - [ ] Command tool: run `npx shadcn add <item> --registry <url>` in sandbox.
  - [ ] Persist install: `installedComponents` in Convex (copy schema/tool metadata).

- **Convex: schema and functions**
  - [ ] Tables: `users`, `projects`, `components`, `blueprints`, `installedComponents`, `threads`, `messages`, `toolCallLogs`, `files` (+ `_storage`), vector index.
  - [ ] Threads/messages: append/read APIs; tool call logs (create/update).
  - [ ] Vector search: ingest registry items → embeddings → vector table; query API.
  - [ ] Files: `generateUploadUrl`, `recordUpload`, `getFileUrl`, `deleteFile`.
  - [ ] Security: authz per project/user; rate limiting.

- **AI SDK 5 orchestration**
  - [ ] Chat route `app/api/chat/route.ts`: dynamic tools from schemas; design tools; visual self-check message injection; stream + mirror to Convex.
  - [ ] Direct tool route `app/api/tools/[toolName]/route.ts`: validate with shared Zod; execute; persist.

- **Editor and preview**
  - [ ] Outline data: `Project.outline`, `activeOutlinePath` (see `docs/11-Outline-and-Navigation.md`).
  - [ ] Outline tools: set_active/create/move/delete/update/attach/detach.
  - [ ] Sidebar UI with DnD; selection syncs preview; optional URL sync.
  - [ ] Click-to-edit: `SchemaForm` from JSON Schema → direct tool route.
  - [ ] Preview renders instances for selected outline node; live Convex subscriptions.

- **Design toolchain**
  - [ ] Tools: `design_generate_image`, `design_image_from_reference`, `design_remove_background`, `design_create_nine_slice`, `design_apply_theme_tokens`, `design_screenshot_page`.
  - [ ] Visual self-check via message injection (no tool); target score ≥ 0.85.
  - [ ] Convex Storage mode: replace local writes with `uploadBufferToConvex` and return `{ fileId, storageId, url }`.

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
  - [ ] Unit: JSON Schema→Zod; outline ops; Convex functions.
  - [ ] E2E: Playwright quiz flow; visual check; MCP flow.
  - [ ] Multiplayer: two-client quiz; scoreboard consistency.

- **Deployment**
  - [ ] Web/registry → Vercel; Colyseus → Fly/Railway/Render; Convex prod.
  - [ ] CI/CD: lint/test/build; preview deployments; secrets.

- **Documentation**
  - [ ] Polish `docs/00–11`; add examples/screenshots; quickstart; ops runbooks.

- **Acceptance (MVP)**
  - [ ] Create project → install `multi-quiz` → generate MCQs → outline navigates steps → two players complete quiz → design pass (image → element → bg remove → 9-slice → theme) → screenshot → LLM similarity ≥ 0.85 → publish preview.
