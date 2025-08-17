## Chat Scenarios

This document contains realistic, end-to-end chat transcripts showing how a creator uses the platform. Each scenario includes assistant tool calls, intermediate artifacts, and the final result as it would appear in the app and preview sandbox.

### Scenario 1 — Create a multi‑step quiz (MCQ + True/False), 20s timer, up to 8 players

Context

- projectId: `p123`
- blueprintId: `multi-quiz`
- target: dynamic Colyseus room (GenericRoom), machine‑driven, runtime schema from DSL

Transcript

User

> Create a multi‑step quiz with 5 questions (mix of MCQ and True/False). 20 seconds per question, scoreboard, a start screen, and a results screen. Up to 8 players.

Assistant

- Plan: (1) generate the state machine (XState JSON + JSONLogic guards) and room state schema (runtime Colyseus Schema from DSL), (2) load machine/state at runtime (no bundling) for preview, (3) scaffold UI files (MCQ/TF blocks, start/results), (4) join dynamic room and preview.
- I’ll start by generating the machine and state.

Assistant → Tool: blueprint_generate_machine

```json
{
  "input": {
    "projectId": "p123",
    "blueprintId": "multi-quiz",
    "spec": {
      "players": { "max": 8 },
      "timing": { "timePerStep": 20 },
      "steps": [
        {
          "kind": "qcm",
          "title": "Q1",
          "choices": ["A", "B", "C", "D"],
          "correctIndex": 1
        },
        { "kind": "tf", "title": "Q2", "correctValue": true },
        {
          "kind": "qcm",
          "title": "Q3",
          "choices": ["A", "B", "C", "D"],
          "correctIndex": 0
        },
        { "kind": "tf", "title": "Q4", "correctValue": false },
        {
          "kind": "qcm",
          "title": "Q5",
          "choices": ["A", "B", "C", "D"],
          "correctIndex": 2
        }
      ]
    }
  }
}
```

Tool → Assistant: blueprint_generate_machine

```json
{
  "output": {
    "machine": {
      "id": "quiz",
      "initial": "idle",
      "context": { "timePerStep": 20, "steps": "<steps-elided>" },
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
    },
    "events": {
      "GAME_START": {
        "type": "object",
        "properties": {},
        "additionalProperties": false
      },
      "ANSWER_SUBMIT": {
        "type": "object",
        "properties": { "index": { "type": "integer", "minimum": 0 } },
        "required": ["index"],
        "additionalProperties": false
      }
    },
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
        "Timer": { "remainingSec": 20 }
      }
    }
  }
}
```

Assistant

- Great. I’ll wire the preview to load the machine and runtime schema directly (no bundling). The dynamic room will receive `{ projectId, blueprintId, version }` and the machine/state JSON in `options`.

Assistant

- I’ll scaffold the UI: start screen, question view (MCQ + True/False), timer, and results. The client will join the dynamic room `"project"` with the provided IDs.

Assistant → Tool: generate_files

```json
{
  "input": {
    "sandboxId": "<active-sandbox>",
    "files": [
      {
        "path": "app/quiz/page.tsx",
        "content": "// quiz page mounting components"
      },
      {
        "path": "components/game/MCQ.tsx",
        "content": "// MCQ component with onAnswer"
      },
      {
        "path": "components/game/TrueFalse.tsx",
        "content": "// True/False component with onAnswer"
      },
      {
        "path": "lib/colyseus/projectClient.ts",
        "content": "// minimal client (send/on)"
      }
    ]
  }
}
```

Tool → Assistant: generate_files

```json
{
  "output": {
    "written": [
      "app/quiz/page.tsx",
      "components/game/MCQ.tsx",
      "components/game/TrueFalse.tsx",
      "lib/colyseus/projectClient.ts"
    ]
  }
}
```

Assistant

- Connect client code snippet (example):

```ts
import { Client } from "colyseus.js";

const client = new Client(process.env.NEXT_PUBLIC_WS_ENDPOINT!);
const room = await client.joinOrCreate("project", {
  projectId: "p123",
  blueprintId: "multi-quiz",
  version: "0.1.0",
  // preview: you can override with bundleUrl if needed
});

room.send("GAME_START", {});
room.onMessage("scoreUpdate", (msg) => console.log(msg));
```

Result

- Preview loads the start screen. When the host triggers `GAME_START`, the room transitions to `question`, the timer ticks every second, and `ANSWER_SUBMIT` advances through 5 steps. Scores update on correct answers. After the last step, the machine reaches `finished`, and the results screen is shown.
- Up to 8 players can join; the room locks after finishing (guarded by actions in the machine’s implementation).

Notes

- The state schema here is generated at runtime from the DSL (see `docs/16-Blueprint-DSL-and-Dynamic-Rooms.md`).
- The dynamic room host loads the server bundle via `import()` (see `apps/server/src/rooms/bundle-loader.ts`), or directly interprets the machine in preview.
- For iterative edits, the assistant can re‑run `blueprint_build_server_bundle` with a bumped `version` and reconnect the preview to the new version.
