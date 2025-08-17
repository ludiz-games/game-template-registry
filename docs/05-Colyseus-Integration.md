### Colyseus Integration (MVP)

#### Quick summary

- We register a single generic room type (`"project" → GenericRoom`).
- Each room instance dynamically loads a versioned blueprint bundle via `import()` and runs that logic.
- Blueprints can be implemented as:
  - a Colyseus `Schema` + `register(room, ctx)` module, or
  - a JSON statechart (XState) wired through a safe interpreter (see `docs/16-Blueprint-DSL-and-Dynamic-Rooms.md`).

This keeps the server core small and secure while supporting many concurrent, per‑project rooms.

#### Goals

- Provide a minimal real-time backbone for the Multi‑Quiz blueprint: join, submit answer, advance question, score updates.

#### Server host (dynamic, recommended)

```ts
// apps/server/src/app.config.ts (relevant lines)
gameServer.define("project", GenericRoom);
```

- Clients join with: `joinOrCreate("project", { projectId, blueprintId, version, bundleUrl?, config? })`.
- Each room instance `import()`s a versioned bundle and runs its logic (see `apps/server/src/rooms/bundle-loader.ts`).

Bundle contract (server ESM):

```ts
// bundles/<projectId>/<blueprintId>/<version>/server.mjs
import { Schema, type } from "@colyseus/schema";

export class State extends Schema {
  /* optional Schema fields if you need */
}

export async function register(room, ctx) {
  // Attach message handlers, timers, and transitions here.
  // Example: room.onMessage("answer.submit", ...) ; room.clock.setInterval(...);
}

export const metadata = { kind: "quiz", version: "0.1.0" };
```

Blueprints MUST provide an XState JSON machine and wire through the safe interpreter (see `docs/16-Blueprint-DSL-and-Dynamic-Rooms.md`). Code bundles are optional optimizations.

#### Runtime‑generated Colyseus Schemas (no bundles)

Instead of shipping `State` classes per blueprint, you can define state in the DSL and generate true Colyseus Schemas at runtime with `defineTypes`. This keeps replicated state faithful to the game model while remaining fully dynamic. See the "Runtime Colyseus Schema from DSL" section in `docs/16-Blueprint-DSL-and-Dynamic-Rooms.md`.

#### Current server approach: Generic dynamic rooms

```ts
// apps/server/src/app.config.ts (relevant lines)
gameServer.define("project", GenericRoom);
```

- Room creation: clients call `joinOrCreate("project", { projectId, blueprintId, version, bundleUrl?, config? })`.
- The room sets `metadata` with `{ projectId, blueprintId, version }` for discovery.
- On `onCreate(options)`, the room resolves and `import()`s the bundle (`apps/server/src/rooms/bundle-loader.ts`).
- If the bundle exports `State`, it is used via `setState(new State())`; otherwise we fall back to `BaseState`.
- The bundle’s `register(room, ctx)` attaches messages/timers/logic.

Bundle contract (minimal):

```ts
// server bundle (ESM)
export class State extends Schema {
  /* optional */
}
export async function register(room, ctx) {
  /* attach handlers, timers */
}
export const metadata = { kind: "quiz", version: "0.1.0" };
```

Alternatively, export an XState JSON machine and use the DSL path (see `docs/16-Blueprint-DSL-and-Dynamic-Rooms.md`).

#### Client wrapper (dynamic)

```ts
// apps/game/lib/colyseus/projectClient.ts
import { Client, Room } from "colyseus.js";

export class ProjectClient {
  private client: Client;
  private room?: Room;

  constructor(endpoint: string) {
    this.client = new Client(endpoint);
  }

  async join(opts: {
    projectId: string;
    blueprintId: string;
    version?: string;
    name?: string;
    bundleUrl?: string;
    config?: any;
  }) {
    this.room = await this.client.joinOrCreate("project", opts);
    return this.room;
  }

  on(event: string, handler: (data: any) => void) {
    this.room?.onMessage(event, handler as any);
  }

  send(event: string, payload: any) {
    this.room?.send(event, payload);
  }
}
```

#### Blueprint Wiring

- The `multi-quiz` blueprint includes `lib/colyseus/quizClient.ts` and uses it inside `app/quiz/page.tsx` to synchronize UI state with the room.

#### Dynamic Rooms & Blueprints (details)

- One handler, many rooms: we register `"project"` once; each call to `joinOrCreate("project", options)` creates or joins a separate room instance.
- Per‑room options: `{ projectId, blueprintId, version, bundleUrl?, config? }` select the bundle and configuration.
- Loading: the host room resolves a local path or signed URL (prod) and `import()`s a versioned ESM bundle.
- Contracts:
  - Code bundle: `State?`, `register(room, ctx)`, and optional `metadata`.
  - DSL bundle: XState JSON + `register` that wires a safe interpreter with named actions/guards and JSONLogic expressions.
- Versioning: bundles live at `bundles/<projectId>/<blueprintId>/<version>/server.mjs` (dev path) or in object storage (prod). Existing rooms keep their loaded module; new rooms use the new version.

See `docs/16-Blueprint-DSL-and-Dynamic-Rooms.md` for the full DSL and safety model.

#### Client usage with dynamic rooms

```ts
// join dynamic room with project + blueprint identity
const room = await client.joinOrCreate("project", {
  projectId: "p123",
  blueprintId: "multi-quiz",
  version: "0.1.0",
});
```

You can also pass `bundleUrl` (absolute URL) to bypass resolution and `config` (per‑room JSON config).

#### Notes

- Host the Colyseus server separately; configure the endpoint via env var.
- Schema/type sharing can be done via a small shared package if we adopt a monorepo.

#### FAQ

- Do we have only one room? No—there is one room type (`GenericRoom`) but many instances, one per match/lobby/project. Each instance loads its own bundle and runs independently.
