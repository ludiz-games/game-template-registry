### Registry and Components/Blueprints

#### Registry Setup

- **Template**: Start from [shadcn-ui/registry-template](https://github.com/shadcn-ui/registry-template).
- **Serve**: Next.js app that builds a `registry.json` and static item payloads under `public/r/[name].json`.
- **Item Types**: `component` and `blueprint`.

#### Item Manifest (shape)

```json
{
  "name": "mcq",
  "type": "component",
  "category": "game-block",
  "description": "Multiple-choice block with title, choices, and correct answer",
  "files": ["components/game/mcq.tsx", "components/game/mcq.schema.ts"],
  "schema": {
    "$id": "mcq.schema",
    "type": "object",
    "properties": {
      "instanceId": { "type": "string" },
      "title": { "type": "string" },
      "choices": {
        "type": "array",
        "items": { "type": "string" },
        "minItems": 2
      },
      "correctIndex": { "type": "integer", "minimum": 0 }
    },
    "required": ["instanceId", "title", "choices", "correctIndex"],
    "additionalProperties": false
  },
  "tool": {
    "name": "create_mcq_data",
    "description": "Generate MCQ data",
    "schemaRef": "mcq.schema"
  },
  "tags": ["quiz", "question", "mcq"],
  "version": "0.1.0"
}
```

#### Blueprint Manifest (shape)

```json
{
  "name": "multi-quiz",
  "type": "blueprint",
  "description": "Basic multi-question quiz with timer and scoreboard, Colyseus-enabled",
  "files": [
    "app/quiz/page.tsx",
    "components/game/mcq.tsx",
    "components/game/timer.tsx",
    "components/game/score.tsx",
    "lib/colyseus/quizClient.ts"
  ],
  "schema": {
    "$id": "multiQuiz.schema",
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "questions": {
        "type": "array",
        "items": { "$ref": "mcq.schema" },
        "minItems": 1
      },
      "timePerQuestionSec": { "type": "integer", "minimum": 5 }
    },
    "required": ["title", "questions"]
  },
  "defaultComponentInstances": [
    {
      "component": "mcq",
      "props": { "title": "Q1", "choices": ["A", "B"], "correctIndex": 0 }
    },
    { "component": "timer", "props": { "seconds": 30 } },
    { "component": "score", "props": {} }
  ],
  "colyseus": {
    "room": "quizRoom",
    "events": ["join", "submitAnswer", "nextQuestion", "scoreUpdate"]
  },
  "tags": ["quiz", "blueprint"],
  "version": "0.1.0"
}
```

#### Component Contract Notes

- **Schema**: Must include `instanceId` for click‑to‑edit operations.
- **DOM**: Each instance should render with `data-component-instance-id="<id>"` to enable UI interactions and tracing.
- **Styling**: Use shadcn primitives and CSS variables; expect the assistant to tweak tokens or component files post‑install.

#### Example: Minimal `mcq.tsx`

```tsx
// components/game/mcq.tsx
import React from "react";

export type MCQProps = {
  instanceId: string;
  title: string;
  choices: string[];
  correctIndex: number;
  onAnswer?: (index: number) => void;
};

export function MCQ({ instanceId, title, choices, onAnswer }: MCQProps) {
  return (
    <div data-component-instance-id={instanceId} className="border rounded p-4">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-2 space-y-1">
        {choices.map((c, i) => (
          <li key={i}>
            <button
              className="w-full text-left border rounded px-3 py-2"
              onClick={() => onAnswer?.(i)}
            >
              {c}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

#### Installation Flow

- The assistant triggers install via CLI in the sandbox:

```bash
npx shadcn add mcq --registry https://your-registry.example.com | cat
```

#### Versioning & Migrations

- Items include `version`; on update, the assistant proposes file edits and schema migrations. Keep old schemas for validation of existing instances.
