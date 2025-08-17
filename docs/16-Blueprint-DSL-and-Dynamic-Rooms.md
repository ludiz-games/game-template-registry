## Blueprint DSL and Dynamic Rooms

### Overview

- One generic room handler on the server (`GenericRoom`) hosts many dynamic room instances.
- Each room instance loads a versioned blueprint bundle at runtime via `import()`.
- Logic is described with a declarative statechart DSL (XState JSON) plus safe expressions (JSONLogic). No arbitrary JS is executed by default.
- Optional: advanced projects may attach sandboxed code extensions later (SES/QuickJS/isolates or WASM) behind a narrow host API.

This design keeps the server core small, secure, and multi‑tenant while allowing per‑project gameplay to evolve independently.

### Runtime building blocks

- Generic room host: `apps/server/src/rooms/GenericRoom.ts`
- Bundle loader: `apps/server/src/rooms/bundle-loader.ts`
- Shared state: `packages/colyseus-types` (`BaseState`, `BasePlayer`, etc.)

### Bundle contract (server ESM)

The server loads an ESM module per room instance. Minimal contract:

- `export class State extends Schema { ... }` (optional). If omitted, `BaseState` is used.
- `export async function register(room, ctx)` required. Wires messages, timers, and actions.
- Recommended for DSL use:
  - `export const machine = {/* XState JSON */}`
  - `export const impl = {/* optional action/guard name mapping */}`
  - `register` may call `registerXState(room, { machine, impl, ctx })` (interpreter provided by the host).

Context provided to `register`:

```ts
type RegisterCtx = {
  projectId: string;
  blueprintId: string;
  version: string;
  clock: any; // colyseus clock
  getConfig: () => Promise<Record<string, any>>; // per-room config
};
```

### DSL: XState JSON + JSONLogic

- Statechart: use XState machine JSON (no code). Supports states, events, guards, actions, and delayed transitions.
- Expressions: use JSONLogic for guards/assignments with `{ state, context, event }` as data.
- Effects/actions: whitelisted side‑effects mapped by name:
  - `set(path, value)` – set room state at path (e.g., `extNum.timeLeftSec`).
  - `inc(path, delta)` – numeric increment.
  - `mapSet(mapPath, key, value)` / `mapDel(mapPath, key)`.
  - `setPhase("question" | "finished" | string)`.
  - `advanceStep()` – bump step index and reset timer.
  - `broadcast(eventName, payload)` – room broadcast.
  - `score.add({ target: "client" | "all", amount })`.
  - `lockRoom()` / `setMaxClients(n)`.
  - `outline.set(id)`.

Guards use JSONLogic, for example:

```json
{ "==": [{ "var": "event.index" }, { "var": "context.current.correctIndex" }] }
```

### Example machine (minimal quiz)

```json
{
  "id": "quiz",
  "initial": "idle",
  "context": { "timePerStep": 30, "steps": [] },
  "states": {
    "idle": {
      "on": {
        "GAME_START": {
          "target": "question",
          "actions": ["resetTimer", "emitDefinition"]
        }
      }
    },
    "question": {
      "after": { "1000": ["tick"] },
      "on": {
        "ANSWER_SUBMIT": [
          {
            "cond": {
              "==": [
                { "var": "event.index" },
                { "var": "context.current.correctIndex" }
              ]
            },
            "actions": [
              {
                "type": "score.add",
                "params": { "target": "client", "amount": 10 }
              }
            ]
          },
          { "actions": ["advanceOrFinish"] }
        ]
      }
    },
    "finished": { "type": "final" }
  }
}
```

At runtime, named actions (e.g., `tick`, `advanceOrFinish`, `resetTimer`) are mapped to the safe effects listed above or to small composites of them.

### Runtime Colyseus Schema from DSL (no bundling)

You can define the replicated room state as first‑class Colyseus Schemas in the DSL and generate classes at runtime (no build step). This avoids generic maps like `extNum`/`extStr` and keeps the state faithful to the game model.

State section in DSL:

```json
{
  "state": {
    "root": "State",
    "classes": {
      "Player": { "id": "string", "name": "string", "score": "number" },
      "Timer": { "remainingSec": "number" },
      "State": {
        "phase": "string",
        "stepIndex": "number",
        "players": { "map": "Player" },
        "timer": { "ref": "Timer" }
      }
    },
    "defaults": {
      "State": { "phase": "idle", "stepIndex": 0 },
      "Timer": { "remainingSec": 30 }
    }
  }
}
```

At room creation, build classes using `defineTypes` and apply defaults (see the full builder sketch in `docs/03-AI-Tools-and-Schema.md`).

This lets the DSL specify precise replicated fields, while the action/logic layer (statechart) drives mutations.

### Mapping to Colyseus

- Messages → events: `room.onMessage("answer.submit")` dispatches `ANSWER_SUBMIT` to the machine.
- Timers: XState `after` transitions are driven by `room.clock.setInterval` and scheduled events.
- State sync: replicate minimal fields in `Schema` (`phase`, `stepIndex`, `timeLeftSec`, scores). Keep transient context in in‑memory vars or `ext*` maps.

### Distribution, versioning, and discovery

- Build outputs: versioned ESM bundles, e.g., `bundles/<projectId>/<blueprintId>/<version>/server.mjs`.
- Room creation options: `{ projectId, blueprintId, version, bundleUrl?, config? }`.
- Metadata: each room sets `{ projectId, blueprintId, version }` for listing/monitoring.

### Security model

- Default: no arbitrary code execution. Only declarative machine + safe effects.
- Validation: JSON Schemas validate incoming messages and config. Machine is validated against an XState JSON schema.
- Optional extensions (advanced): allow sandboxed `script` actions using SES/QuickJS/isolates with strict CPU/memory/time caps and a minimal host API.

### Client stubs (optional but recommended)

- From event schemas, generate a tiny typed client: `send(event, payload)` with literal event names and payload types; `onMessage(name, handler)` wrappers.

### Authoring and generation flow

1. Author blueprint machine JSON (or ask the assistant to generate it) and event schemas.
2. Package into a server bundle exporting `{ State?, machine, register }`.
3. Upload to storage (versioned) and store bundle URL.
4. Client joins `"project"` room with `{ projectId, blueprintId, version }`; server loads the bundle and runs it.

### References

- Generic room dynamic loading is discussed in the shared conversation: https://chatgpt.com/share/68a25125-968c-8002-8501-00c86c273f6f
