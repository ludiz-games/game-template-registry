### Implementation Plan and Milestones

#### M0 – Decisions & Skeletons ✅ COMPLETED

- **✅ Decided**: DB (Supabase/Postgres), Auth (Better Auth), Hosting (Vercel + Fly/Railway), Registry placement.
- **✅ Scaffolded**: `apps/registry` from [shadcn-ui/registry-template](https://github.com/shadcn-ui/registry-template).
- **✅ Created**: Components: `mcq-component`, `true-false-component`, `quiz-timer` with JSON Schemas.
- **✅ Delivered**: Registry serves manifests; shadcn CLI verified working locally.
- **✅ Bonus**: Complete Colyseus integration with `@ludiz/colyseus-hooks` package, working multiplayer game.

#### M1 – Assistant ↔ Registry Loop 🚧 NEXT

- **Setup**: Supabase database (SQL schema, pgvector), Realtime channels (Broadcast or postgres_changes), and storage buckets.
- **Implement**: Vector search over components/blueprints.
- **Wiring**: Sandbox command to run `shadcn add <item> --registry <url>`.
- **Runtime**: JSON Schema → Zod → dynamic tool registration per project/thread.
- **UI**: Click‑to‑edit using schema‑driven form; persist to `gameDefinition`.
- **Deliver**: User can add an MCQ, generate data via tool, and edit via form.

#### M2 – Colyseus MVP ✅ COMPLETED EARLY

- **✅ Server**: `FullLLMRoom` with join/submit/next/score implemented.
- **✅ Client**: `@ludiz/colyseus-hooks` wrapper and game integration complete.
- **✅ Delivered**: Two players can join and complete multiplayer quiz successfully.

#### M3 – Components, Blueprints, Design Toolchain

- **Components**: True/False, Timer, Score, Nav.
- **Blueprints**: Point & Click, You’re the Hero baseline.
- **Design Tools**: Implement all tools; asset storage decisions; basic doc for usage patterns.
- **Sandbox Realtime**: Wire Supabase Realtime Broadcast for editor↔preview updates (see `docs/15-Sandbox-Realtime.md`).
- **Deliver**: Assistant can perform a design pass end‑to‑end for the quiz.

#### M4 – Hardening & UX

- **Versioning**: Registry item versioning and upgrade flows.
- **Migrations**: Schema migrations for existing instances.
- **AuthZ**: Project access control; audit logs of tool calls.
- **Quality**: LLM-based visual compare gates (score thresholds); e2e flows with Playwright.

#### Risk & Mitigations

- **Tool sprawl**: Keep tool names stable and well‑documented; alias versions.
- **Model context limits**: Use tool descriptions concisely; rely on deterministic tools for verification.
- **Registry drift**: Pin versions; log install manifests with checksums.

#### Acceptance (MVP)

- From an empty project, the creator can: search → install `multi-quiz` → generate MCQs → preview → invite a second player to complete the quiz → run a design pass (image → element → bg remove → 9‑slice → theme) → capture screenshot → pass LLM visual similarity ≥ 0.85.
