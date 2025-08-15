### Orchestration with AI SDK 5 + Convex

This document records the decision and shows how to wire AI SDK 5 for interactive orchestration while using Convex for real-time persistence, vectors/RAG, and background work.

#### Decision

- **Orchestrator**: AI SDK 5 for chat runs, dynamic tools, message shaping (including multi-part image messages), MCP interop, and streaming.
- **State**: Convex for users, projects, threads/messages persistence, tool call logs, vector search for registry items, and background jobs.

#### Why this split

- AI SDK 5 simplifies per-run control (tools/messages) and streaming UI integration.
- Convex provides real-time state and a batteries-included agents ecosystem (RAG, vectors, threads) for persistence and retrieval outside the hot path.

#### Integration points

- Dynamic tool registration (registry schemas → tools) happens at the start of each AI SDK run, pulling installed components from Convex.
- Message shaping (e.g., visual self-check injection) happens in the Next.js route before calling the model.
- Streaming events (assistant deltas, tool calls/results) are mirrored to Convex threads/messages for history and multi-client visibility.

#### Minimal types in Convex

```ts
// convex/schema.ts (shape sketch, adapt to your tables/utils)
export type Thread = {
  _id: string;
  projectId: string;
  userId: string;
  title?: string;
  createdAt: number;
};

export type Message = {
  _id: string;
  threadId: string;
  role: "user" | "assistant" | "tool" | "system";
  content: any; // model parts, text, or tool payload (JSON)
  createdAt: number;
};

export type ToolCallLog = {
  _id: string;
  threadId: string;
  name: string;
  args: any;
  result?: any;
  createdAt: number;
};
```

#### Next.js route: orchestrate, stream, and persist

```ts
// app/api/chat/route.ts
import { NextRequest } from "next/server";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { getRuntimeToolsForProject } from "@/runtime/registryToolRuntime";
import { getDesignTools } from "@/runtime/designTools";
import { injectVisualCheck } from "@/runtime/visualSelfCheck";
import { convex } from "@/lib/convexClient"; // wrap server-side Convex calls

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { projectId, userId, threadId, messages, baseUrl, visualCheck } =
    await req.json();

  const componentTools = await getRuntimeToolsForProject(projectId);
  const designTools = getDesignTools();

  const msgs =
    visualCheck?.baselineUrl && visualCheck?.candidateUrl
      ? injectVisualCheck(messages, visualCheck)
      : messages;

  const tools = {
    ...componentTools,
    ...Object.fromEntries(
      Object.entries(designTools).map(([name, def]) => [
        name,
        {
          description: def.description,
          parameters: def.parameters,
          execute: (args: any) =>
            def.execute(args, { projectId, baseUrl, assetsDir: "public" }),
        },
      ])
    ),
  };

  // Mirror the incoming user message to Convex
  await convex.messages.append({
    threadId,
    role: "user",
    content: msgs[msgs.length - 1],
  });

  const result = await streamText({
    model: openai("gpt-4o-mini"),
    messages: msgs,
    tools,
    toolChoice: "auto",
    maxSteps: 10,
    onToolCall: async ({ toolName, args }) => {
      await convex.toolCalls.log({ threadId, name: toolName, args });
    },
    onToolResult: async ({ toolName, result }) => {
      await convex.toolCalls.updateLast({ threadId, name: toolName, result });
    },
    onFinish: async ({ text }) => {
      // Persist assistant message
      await convex.messages.append({
        threadId,
        role: "assistant",
        content: text,
      });
    },
  });

  return result.toAIStreamResponse();
}
```

#### Pulling tools from Convex at run start

- Your `getRuntimeToolsForProject(projectId)` should fetch the installed components from Convex and compile their JSON Schemas to tools (as in `03-AI-Tools-and-Schema.md`).
- Optionally, fetch blueprint-specific tools or feature flags from Convex too.

#### Real-time UI

- Subscribe to `threads` and `messages` in the UI; as tool calls and assistant deltas are mirrored, the UI updates live.

#### Vectors and RAG

- Use Convex vector tables to index registry items (components/blueprints). A search tool can query Convex and return ranked items for the assistant to install.

#### Background Work

- Offload long-running tasks (e.g., asset uploads, ingestion, batch migrations) into Convex actions/crons, while the AI SDK run remains snappy.

#### Security

- Gate tools per project/user, and validate access in tool executors.
- Don’t pass sensitive data via model messages; store file references in Convex and fetch via signed URLs where needed.

#### Notes

- Keep this split: AI SDK 5 controls the interactive step-by-step flow; Convex owns persistence, retrieval, and real-time fan-out.
- MCP tools (e.g., Skyvern) can be merged into the AI SDK tool list per run; see `08-MCP-Integration-Skyvern.md`.
