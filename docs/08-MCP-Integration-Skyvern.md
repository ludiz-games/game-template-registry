### MCP Integration: Skyvern

Use an external MCP browser agent (Skyvern) to let the assistant autonomously explore and test the UI. This removes the need to maintain our own Playwright toolset and gives the model a higher-level browser interface.

Reference: [Skyvern MCP docs](https://docs.skyvern.com/integrations/mcp)

#### Setup

- Install Skyvern (Python 3.11+):

```bash
pip install skyvern
skyvern init
```

- Configure for Cloud or Local. Ensure `SKYVERN_BASE_URL` and `SKYVERN_API_KEY` are set in the environment (Cloud) or available from `.env` created by `skyvern init`.
- Start the MCP server process (local mode only):

```bash
skyvern run mcp
```

#### App integration (Node, MCP client via stdio)

```ts
// runtime/mcp/skyvernClient.ts
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { MCPClient } from "@modelcontextprotocol/sdk/client/index.js";
import { z } from "zod";
import type { JSONSchema7 } from "json-schema";

export async function startSkyvernMCP(options?: {
  pythonPath?: string; // e.g., "python3" or absolute path
  env?: NodeJS.ProcessEnv;
}) {
  const python = options?.pythonPath ?? "python3";
  const env = { ...process.env, ...(options?.env ?? {}) };

  const proc: ChildProcessWithoutNullStreams = spawn(
    python,
    ["-m", "skyvern", "run", "mcp"],
    {
      env,
    }
  );

  const transport = new StdioClientTransport({
    stdin: proc.stdin,
    stdout: proc.stdout,
  });

  const client = new MCPClient({ transport, capabilities: {} });
  await client.connect();

  return { client, proc };
}

export async function listSkyvernTools(client: MCPClient) {
  const res = await client.listTools();
  return res.tools; // [{ name, description, input_schema, ... }]
}

// Minimal JSON Schema → Zod converter (reuse our existing util in runtime)
function jsonSchemaToZod(schema: JSONSchema7): z.ZodTypeAny {
  switch (schema.type) {
    case "string":
      return z.string();
    case "integer":
      return z.number().int();
    case "number":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array":
      return z.array(jsonSchemaToZod((schema.items || {}) as JSONSchema7));
    case "object":
    default: {
      const props = (schema.properties || {}) as Record<string, JSONSchema7>;
      const required = new Set(schema.required || []);
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [key, def] of Object.entries(props)) {
        const inner = jsonSchemaToZod(def);
        shape[key] = required.has(key) ? inner : inner.optional();
      }
      return z.object(shape);
    }
  }
}

export async function asAiSdkTools(client: MCPClient) {
  const tools = await listSkyvernTools(client);
  const mapped: Record<string, any> = {};
  for (const t of tools) {
    const params = t.input_schema
      ? jsonSchemaToZod(t.input_schema as JSONSchema7)
      : z.object({});
    mapped[t.name] = {
      description: t.description || `Skyvern MCP: ${t.name}`,
      parameters: params,
      execute: async (args: any) => {
        const result = await client.callTool({ name: t.name, arguments: args });
        return result;
      },
    };
  }
  return mapped;
}
```

#### Chat route using Skyvern MCP tools

```ts
// app/api/agent/route.ts
import { NextRequest } from "next/server";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { startSkyvernMCP, asAiSdkTools } from "@/runtime/mcp/skyvernClient";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { messages = [], goal } = await req.json();
  const { client, proc } = await startSkyvernMCP();
  const mcpTools = await asAiSdkTools(client);

  const sys = {
    role: "system" as const,
    content:
      "You are a UI autopilot. Use available tools (from MCP) to navigate, click, type, and verify the UI to accomplish the goal with minimal steps.",
  };

  const user = { role: "user" as const, content: `Goal: ${goal}` };

  try {
    const result = await streamText({
      model: openai("gpt-4o-mini"),
      messages: [sys, ...messages, user],
      tools: mcpTools,
      toolChoice: "auto",
      maxSteps: 30,
    });
    return result.toAIStreamResponse();
  } finally {
    // Close the MCP subprocess when done
    proc.kill();
  }
}
```

#### Operational notes

- Run the Skyvern MCP server as a sidecar or spawn per-request (short sessions). For long-running agents, maintain a pool keyed by user/session.
- Enforce allowlists: encode the permitted host(s) in Skyvern or in the system prompt.
- Log tool calls and redact sensitive fields.

#### When to use MCP vs local Playwright tools

- **MCP (Skyvern)**: Preferred for production autopilot, less infra to maintain, richer browser skills, works across MCP-enabled apps. See [Skyvern MCP docs](https://docs.skyvern.com/integrations/mcp).
- **Local Playwright tools**: Useful for deterministic CI flows or when offline; keep as fallback.
