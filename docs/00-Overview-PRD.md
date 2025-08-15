### Vibe Game Builder – Product Requirements (MVP)

#### Objective

- **Goal**: A chat-driven assistant that scaffolds playable game experiences by installing and customizing registry-provided UI/game components and blueprints, wiring real-time gameplay via Colyseus, and enabling rapid design iteration with image-aided tools.
- **Scope (MVP)**: One end-to-end blueprint (Multi‑Quiz) from install → data generation → preview → multiplayer (Colyseus) → design pass using the design toolchain.

#### Problem & Value

- **Problem**: Building small games/experiences is slow: component discovery, wiring, data modeling, real-time state, and design execution all require context switching.
- **Value**: The assistant unifies discovery, install, data creation, real-time wiring, and design iteration through dynamic tools derived from component schemas.

#### Users & Primary Journeys

- **Creator (primary)**: Interacts with the assistant to compose a game; installs components/blueprints; edits component data via click-to-edit; runs a design workflow; publishes.
- **Player (secondary)**: Plays Colyseus-powered experiences.
- **Admin (secondary)**: Oversees registry items and system health.

#### MVP Capabilities

- **Registry integration**: Search and install components/blueprints from a custom shadcn registry using the CLI. Reference: [shadcn-ui/registry-template](https://github.com/shadcn-ui/registry-template).
- **Dynamic tools from schemas**: Convert registry item JSON Schemas into runtime AI tools per conversation to generate/validate component data.
- **Click-to-edit**: Open a schema-bound form for any component instance; persisted updates roundtrip without the LLM.
- **Blueprints**: A minimal Multi‑Quiz blueprint composed of MCQ + Timer + Score; server support with a Colyseus room.
- **Design toolchain**: Image generation, reference-driven element rendering, background removal, 9‑slice asset creation, theme token application, screenshots, visual diff, flow simulation.

#### Non‑Goals (MVP)

- Marketplace/payments, analytics dashboards, complex moderation/linting for user code, full theming studio.

#### Assumptions

- **Stack**: Next.js app, **AI SDK 5** (Vercel AI) for orchestration, **Convex DB** for state/vectors/threads, **Better Auth** for authentication.
- **Hosting**: Next.js on Vercel (or similar); Colyseus server on Fly/Railway/Render.
- **Assets**: Local in `public/` during development; object storage in production.

#### Success Metrics (indicative)

- **TTV (time-to-value)**: < 10 minutes from blank to playable quiz.
- **Assistant autonomy**: ≥ 70% of steps completed via tool calls without manual code edits.
- **Design parity**: LLM similarity score ≥ 0.85 comparing baseline vs implemented screenshot on first design pass.

#### Milestones (high-level)

- **M0**: Decisions + skeletons (registry, MCQ, blueprint, dynamic tools groundwork).
- **M1**: Assistant ↔ registry loop; click-to-edit; persistence.
- **M2**: Colyseus server + client glue; multiplayer quiz flow.
- **M3**: Additional components + two more blueprints; design toolchain stabilized.
- **M4**: Versioning, migrations, multi-project support, hardening.

#### References

- Custom registry template: [shadcn-ui/registry-template](https://github.com/shadcn-ui/registry-template)
