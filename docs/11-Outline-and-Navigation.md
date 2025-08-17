### Outline and Navigation

The Outline is the primary navigational structure of a game. It enables creators (and the assistant) to define, edit, and traverse the game flow. It drives the editor sidebar navigation and the runtime progression (including Colyseus sync for multiplayer).

#### Concepts

- **Outline**: A tree (or linear list) of nodes representing steps, groups, or branches.
- **Node**: A unit in the outline, bound to one or more component instances to render at that point.
- **Path**: An array of node IDs from the root to a target node; used to select the active node in the editor/preview.

#### Type shapes (sketch)

```ts
// OutlineNode kinds
type OutlineNodeKind = "group" | "step" | "branch";

type OutlineNodeBase = {
  id: string; // stable id
  title: string; // shown in sidebar
  kind: OutlineNodeKind;
};

// A logical container (no rendering by itself)
type GroupNode = OutlineNodeBase & {
  kind: "group";
  children: OutlineNode[];
};

// A renderable step (one or more component instances)
type StepNode = OutlineNodeBase & {
  kind: "step";
  componentInstanceIds: string[]; // e.g., [mcq-1, timer-1]
  meta?: { timerSeconds?: number; skippable?: boolean };
};

// A branching decision; each child is a branch outcome
type BranchNode = OutlineNodeBase & {
  kind: "branch";
  children: Array<OutlineNode & { condition?: any }>; // condition optional; may be data-driven
};

type OutlineNode = GroupNode | StepNode | BranchNode;

type Outline = {
  root: OutlineNode;
};

// Editor selection
type OutlinePath = string[]; // [rootId, childId, ...]
```

#### Data model placement

- Stored on `Project.outline: Outline`.
- Editor selection `Project.activeOutlinePath?: OutlinePath` (or client-only state).
- Each `ComponentInstance` should be associated with one or more Outline nodes via `componentInstanceIds` lists.

#### Blueprint integration

- Blueprints should ship a default `outline` compatible with their schema.
- Example: Multi‑Quiz ships a linear group with `step` children, one per MCQ.

```json
{
  "outline": {
    "root": {
      "id": "quiz",
      "title": "Quiz",
      "kind": "group",
      "children": [
        {
          "id": "q1",
          "title": "Q1",
          "kind": "step",
          "componentInstanceIds": ["mcq-1", "timer-1"]
        },
        {
          "id": "q2",
          "title": "Q2",
          "kind": "step",
          "componentInstanceIds": ["mcq-2", "timer-1"]
        },
        {
          "id": "results",
          "title": "Results",
          "kind": "step",
          "componentInstanceIds": ["score-1"]
        }
      ]
    }
  }
}
```

Branching example (You’re the Hero):

```json
{
  "outline": {
    "root": {
      "id": "story",
      "title": "Story",
      "kind": "group",
      "children": [
        {
          "id": "scene-1",
          "title": "Scene 1",
          "kind": "step",
          "componentInstanceIds": ["scene-1-view"]
        },
        {
          "id": "choice-1",
          "title": "Choice",
          "kind": "branch",
          "children": [
            {
              "id": "path-a",
              "title": "Go left",
              "kind": "step",
              "componentInstanceIds": ["scene-2a-view"]
            },
            {
              "id": "path-b",
              "title": "Go right",
              "kind": "step",
              "componentInstanceIds": ["scene-2b-view"]
            }
          ]
        }
      ]
    }
  }
}
```

#### Editor UX

- Sidebar renders the outline tree with titles; selecting a node sets `activeOutlinePath` and focuses the preview on that node’s instances.
- Drag‑and‑drop to reorder siblings; context menus to add step/group/branch.
- Clicking a `step` highlights its component instances; clicking an instance opens schema form (click‑to‑edit).
- Render instances with `data-component-instance-id` and optionally `data-outline-node-id` for tracing.

#### Tools for outline operations (LLM + UI)

- `outline_set_active`: `{ path: string[] }` → sets current editor selection.
- `outline_create_node`: `{ parentPath: string[], kind: 'step'|'group'|'branch', title: string, afterId?: string }`.
- `outline_move_node`: `{ path: string[], newParentPath: string[], afterId?: string }`.
- `outline_delete_node`: `{ path: string[] }`.
- `outline_update_node`: `{ path: string[], patch: { title?: string, meta?: any } }`.
- `outline_attach_instance`: `{ path: string[], instanceId: string }`.
- `outline_detach_instance`: `{ path: string[], instanceId: string }`.

All operations mutate `Project.outline` and persist. Validation: prevent cycles, ensure IDs unique, and maintain references in `componentInstanceIds`.

Schema sketch for a single tool with operations array:

```ts
import { z } from "zod";

export const OutlineOperation = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_active"), path: z.array(z.string()) }),
  z.object({
    op: z.literal("create"),
    parentPath: z.array(z.string()),
    kind: z.enum(["step", "group", "branch"]),
    title: z.string(),
    afterId: z.string().optional(),
  }),
  z.object({
    op: z.literal("move"),
    path: z.array(z.string()),
    newParentPath: z.array(z.string()),
    afterId: z.string().optional(),
  }),
  z.object({ op: z.literal("delete"), path: z.array(z.string()) }),
  z.object({
    op: z.literal("update"),
    path: z.array(z.string()),
    patch: z.object({ title: z.string().optional(), meta: z.any().optional() }),
  }),
  z.object({
    op: z.literal("attach_instance"),
    path: z.array(z.string()),
    instanceId: z.string(),
  }),
  z.object({
    op: z.literal("detach_instance"),
    path: z.array(z.string()),
    instanceId: z.string(),
  }),
]);

export const OutlineOperations = z.object({
  operations: z.array(OutlineOperation).min(1),
});
```

#### Runtime and preview

- The preview reads `activeOutlinePath` and renders the node’s `componentInstanceIds`. If empty, show a placeholder prompting to add a component.
- Optionally sync `activeOutlinePath` to the URL (`?node=...` or encoded path) for deep linking.

#### Colyseus mapping (machine‑driven)

- The XState JSON machine is the primary driver of runtime flow and timers. All room events map to machine events.
- The machine mutates the replicated state (Colyseus Schema) and emits broadcasts. Outline progression is expressed as machine transitions.
- See `docs/16-Blueprint-DSL-and-Dynamic-Rooms.md` for the required machine format and how it maps to Colyseus.

#### Blueprint authoring guidance

- Always include an initial outline compatible with default components.
- Provide human‑readable `title` values for sidebar clarity.
- For branching games, prefer shallow trees with named branches to keep navigation manageable.

#### Migration

- If a blueprint evolves, provide a migration function mapping old outline node IDs to new ones or inserting new nodes with sensible defaults.
