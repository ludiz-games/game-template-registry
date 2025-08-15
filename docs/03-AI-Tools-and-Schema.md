### Dynamic Tools from JSON Schema

#### Overview

- **Why**: Registry items carry JSON Schemas; we compile them into runtime AI tools (Zod) per project/thread to generate and validate component data.
- **Two paths**:
  - LLM‑driven tool calls (chat).
  - Direct form‑driven calls (click‑to‑edit) using the same validation and executor.

#### Runtime: compile JSON Schema → Tool

```ts
// runtime/registryToolRuntime.ts
import { z } from "zod";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

function jsonSchemaToZod(
  schema: JSONSchema7,
  registry: Record<string, JSONSchema7> = {}
): z.ZodTypeAny {
  if (schema.$ref) {
    const ref = schema.$ref.replace(/^#\//, "");
    const target = registry[ref] || registry[schema.$id ?? ""];
    if (!target) throw new Error(`$ref not found: ${schema.$ref}`);
    return jsonSchemaToZod(target, registry);
  }

  switch (schema.type) {
    case "string": {
      let s = z.string();
      if (schema.minLength !== undefined) s = s.min(schema.minLength);
      if (schema.maxLength !== undefined) s = s.max(schema.maxLength);
      return s;
    }
    case "integer": {
      let n = z.number().int();
      if (schema.minimum !== undefined) n = n.min(schema.minimum);
      if (schema.maximum !== undefined) n = n.max(schema.maximum);
      return n;
    }
    case "number": {
      let n = z.number();
      if (schema.minimum !== undefined) n = n.min(schema.minimum);
      if (schema.maximum !== undefined) n = n.max(schema.maximum);
      return n;
    }
    case "boolean":
      return z.boolean();
    case "array": {
      const items = (schema.items || {}) as JSONSchema7;
      let a = z.array(jsonSchemaToZod(items, registry));
      if (schema.minItems !== undefined) a = a.min(schema.minItems);
      if (schema.maxItems !== undefined) a = a.max(schema.maxItems);
      return a;
    }
    case "object":
    default: {
      const props = (schema.properties || {}) as Record<
        string,
        JSONSchema7Definition
      >;
      const required = new Set(schema.required || []);
      const shape: Record<string, z.ZodTypeAny> = {};

      for (const [key, def] of Object.entries(props)) {
        const propSchema = def as JSONSchema7;
        const zodProp = jsonSchemaToZod(propSchema, registry);
        shape[key] = required.has(key) ? zodProp : zodProp.optional();
      }

      let o = z.object(shape);
      if (schema.additionalProperties === false) {
        o = o.strict();
      }
      return o;
    }
  }
}

type RegistryItem = {
  name: string;
  description?: string;
  schema: JSONSchema7;
  refs?: Record<string, JSONSchema7>;
  toolName: string;
};

type ProjectContext = {
  projectId: string;
  userId: string;
  componentName?: string;
};

async function saveComponentInstanceProps(
  projectId: string,
  componentName: string,
  instanceId: string,
  props: unknown
) {
  return { ok: true, projectId, componentName, instanceId, props };
}

export function createToolFromRegistryItem(item: RegistryItem) {
  const parameters = jsonSchemaToZod(item.schema, item.refs || {});
  return {
    [item.toolName]: {
      description: item.description ?? `Tool for ${item.name}`,
      parameters,
      execute: async (
        args: Record<string, unknown> & { instanceId?: string },
        ctx: ProjectContext
      ) => {
        const instanceId = String(args.instanceId ?? "");
        const { instanceId: _ignored, ...props } = args;
        return saveComponentInstanceProps(
          ctx.projectId,
          ctx.componentName ?? item.name,
          instanceId,
          props
        );
      },
    },
  };
}

export async function getRuntimeToolsForProject(projectId: string) {
  const installed: RegistryItem[] = await getInstalledRegistryItems(projectId);
  return installed.reduce((acc, item) => {
    Object.assign(acc, createToolFromRegistryItem(item));
    return acc;
  }, {} as Record<string, any>);
}

async function getInstalledRegistryItems(
  projectId: string
): Promise<RegistryItem[]> {
  return [
    {
      name: "mcq",
      description: "Generate MCQ data",
      toolName: "create_mcq_data",
      schema: {
        $id: "mcq.schema",
        type: "object",
        properties: {
          instanceId: { type: "string" },
          title: { type: "string" },
          choices: { type: "array", items: { type: "string" }, minItems: 2 },
          correctIndex: { type: "integer", minimum: 0 },
        },
        required: ["instanceId", "title", "choices", "correctIndex"],
        additionalProperties: false,
      },
    },
  ];
}

export async function runChatWithProjectTools(params: {
  projectId: string;
  userId: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
}) {
  const tools = await getRuntimeToolsForProject(params.projectId);

  const result = await streamText({
    model: openai("gpt-4o-mini"),
    messages: params.messages,
    tools,
    toolChoice: "auto",
    maxSteps: 3,
    onToolCall: ({ toolName, args }) => {
      console.log("Tool call", { toolName, args });
    },
    // @ts-expect-error: sdk passes context into execute
    context: { projectId: params.projectId, userId: params.userId },
  });

  return result.toAIStreamResponse();
}
```

#### Chat Route (LLM path)

```ts
// app/api/chat/route.ts
import { NextRequest } from "next/server";
import { runChatWithProjectTools } from "@/runtime/registryToolRuntime";

export const runtime = "edge"; // or "nodejs"

export async function POST(req: NextRequest) {
  const { projectId, userId, messages } = await req.json();
  return runChatWithProjectTools({ projectId, userId, messages });
}
```

#### Click‑to‑Edit: Schema → Form → Tool (no LLM)

```tsx
// components/editor/SchemaForm.tsx
"use client";

import React, { useMemo, useState } from "react";
import type { JSONSchema7 } from "json-schema";

type Props = {
  schema: JSONSchema7;
  initialValue?: Record<string, any>;
  onSubmit: (value: Record<string, any>) => Promise<void>;
};

export function SchemaForm({ schema, initialValue, onSubmit }: Props) {
  const [value, setValue] = useState<Record<string, any>>(initialValue || {});
  const properties = (schema.properties || {}) as Record<string, JSONSchema7>;
  const required = new Set(schema.required || []);

  const fields = useMemo(
    () => Object.entries(properties).filter(([k]) => k !== "instanceId"),
    [properties]
  );

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(value);
      }}
      className="space-y-3"
    >
      {fields.map(([key, prop]) => {
        const t = prop.type;
        const label = `${key}${required.has(key) ? " *" : ""}`;

        if (t === "string") {
          return (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-sm">{label}</label>
              <input
                className="border rounded p-2"
                value={value[key] ?? ""}
                onChange={(e) =>
                  setValue((v) => ({ ...v, [key]: e.target.value }))
                }
              />
            </div>
          );
        }

        if (t === "integer" || t === "number") {
          return (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-sm">{label}</label>
              <input
                type="number"
                className="border rounded p-2"
                value={value[key] ?? 0}
                onChange={(e) =>
                  setValue((v) => ({ ...v, [key]: Number(e.target.value) }))
                }
              />
            </div>
          );
        }

        if (t === "array" && (prop.items as JSONSchema7)?.type === "string") {
          const arr: string[] = Array.isArray(value[key]) ? value[key] : [];
          return (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-sm">{label}</label>
              {arr.map((val, idx) => (
                <input
                  key={idx}
                  className="border rounded p-2 mb-1"
                  value={val}
                  onChange={(e) => {
                    const next = [...arr];
                    next[idx] = e.target.value;
                    setValue((v) => ({ ...v, [key]: next }));
                  }}
                />
              ))}
              <button
                type="button"
                className="border rounded px-2 py-1 text-sm"
                onClick={() => setValue((v) => ({ ...v, [key]: [...arr, ""] }))}
              >
                Add item
              </button>
            </div>
          );
        }

        return (
          <div key={key} className="text-xs text-gray-500">
            Unsupported field type: {String(t)}
          </div>
        );
      })}

      <button type="submit" className="border rounded px-3 py-2">
        Save
      </button>
    </form>
  );
}
```

```tsx
// components/game/MCQCard.tsx (example consumer)
"use client";
import { useState } from "react";
import type { JSONSchema7 } from "json-schema";
import { SchemaForm } from "@/components/editor/SchemaForm";

export function MCQCard({
  instanceId,
  schema,
  toolName,
  projectId,
  data,
}: {
  instanceId: string;
  schema: JSONSchema7;
  toolName: string;
  projectId: string;
  data: { title: string; choices: string[]; correctIndex: number };
}) {
  const [open, setOpen] = useState(false);

  async function callToolDirect(args: Record<string, any>) {
    await fetch(`/api/tools/${toolName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, args: { instanceId, ...args } }),
    });
  }

  return (
    <div data-component-instance-id={instanceId} className="border p-4 rounded">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{data.title}</h3>
        <button className="text-sm underline" onClick={() => setOpen(true)}>
          Edit
        </button>
      </div>

      <ul className="list-disc pl-5 mt-2">
        {data.choices.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>

      {open ? (
        <div className="mt-4 border-t pt-4">
          <SchemaForm
            schema={schema}
            initialValue={data}
            onSubmit={async (value) => {
              await callToolDirect(value);
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
```

#### Tool Execution Endpoint (form path)

```ts
// app/api/tools/[toolName]/route.ts
import { NextRequest } from "next/server";
import { getRuntimeToolsForProject } from "@/runtime/registryToolRuntime";

export async function POST(
  req: NextRequest,
  { params }: { params: { toolName: string } }
) {
  const { projectId, args, userId } = await req.json();
  const tools = await getRuntimeToolsForProject(projectId);
  const tool = tools[params.toolName];

  if (!tool) {
    return new Response(JSON.stringify({ error: "Tool not found" }), {
      status: 404,
    });
  }

  const parsed = await tool.parameters.parseAsync(args);
  const result = await tool.execute(parsed, {
    projectId,
    userId,
    componentName: undefined,
  });
  return new Response(JSON.stringify(result), { status: 200 });
}
```
