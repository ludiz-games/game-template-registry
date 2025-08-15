### Implementation Plan and Milestones

#### M0 – Decisions & Skeletons

- **Decide**: DB (Convex), Auth (Better Auth), Hosting (Vercel + Fly/Railway), Registry placement.
- **Scaffold**: `apps/registry` from [shadcn-ui/registry-template](https://github.com/shadcn-ui/registry-template).
- **Create**: First items: `mcq` component + `multi-quiz` blueprint with JSON Schemas.
- **Deliver**: Registry serves manifests; shadcn CLI can fetch files locally.

#### M1 – Assistant ↔ Registry Loop

- **Implement**: Vector search over components/blueprints.
- **Wiring**: Sandbox command to run `shadcn add <item> --registry <url>`.
- **Runtime**: JSON Schema → Zod → dynamic tool registration per project/thread.
- **UI**: Click‑to‑edit using schema‑driven form; persist to `gameDefinition`.
- **Deliver**: User can add an MCQ, generate data via tool, and edit via form.

#### M2 – Colyseus MVP

- **Server**: `quizRoom` with join/submit/next/score.
- **Client**: Wrapper and page integration; optimistic UI where useful.
- **Deliver**: Two players can join and complete a short quiz.

#### M3 – Components, Blueprints, Design Toolchain

- **Components**: True/False, Timer, Score, Nav.
- **Blueprints**: Point & Click, You’re the Hero baseline.
- **Design Tools**: Implement all tools; asset storage decisions; basic doc for usage patterns.
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
