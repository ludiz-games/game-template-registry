### Orchestration with AI SDK 5 + Supabase (Postgres)

This document records the decision and shows how to wire AI SDK 5 for interactive orchestration while using Supabase (Postgres) for persistence, vectors/RAG, storage, and real-time (Broadcast or postgres_changes).

#### Decision

- **Orchestrator**: AI SDK 5 for chat runs, dynamic tools, message shaping (including multi-part image messages), MCP interop, and streaming.
- **State**: Supabase/Postgres for users, projects, threads/messages persistence, tool call logs, vector search for registry items (pgvector), and storage; Realtime for subscriptions/broadcasts.

#### Why this split

- AI SDK 5 simplifies per-run control (tools/messages) and streaming UI integration.
- Supabase provides Postgres with realtime and storage, plus pgvector for retrieval outside the hot path.

#### Integration points

- Dynamic tool registration (registry schemas → tools) happens at the start of each AI SDK run, pulling installed components from Postgres.
- Message shaping (e.g., visual self-check injection) happens in the Next.js route before calling the model.
- Streaming events (assistant deltas, tool calls/results) are persisted to `threads/messages` for history and multi-client visibility.

#### Minimal tables in Postgres

```ts
// threads(id uuid pk, project_id uuid fk, user_id uuid fk, title text, created_at timestamptz)
// messages(id uuid pk, thread_id uuid fk, role text, content jsonb, created_at timestamptz)
// tool_call_logs(id uuid pk, thread_id uuid fk, name text, args jsonb, result jsonb, created_at timestamptz)
```

#### Next.js route: orchestrate, stream, and persist

```ts
// app/api/chat/route.ts (sketch)
import { NextRequest } from "next/server";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { getRuntimeToolsForProject } from "@/runtime/registryToolRuntime";
import { getDesignTools } from "@/runtime/designTools";
import { injectVisualCheck } from "@/runtime/visualSelfCheck";
import { db } from "@/lib/db"; // drizzle/prisma/pg client

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

  // Persist incoming user message
  await db
    .insert("messages")
    .values({
      thread_id: threadId,
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
      await db
        .insert("tool_call_logs")
        .values({ thread_id: threadId, name: toolName, args });
    },
    onToolResult: async ({ toolName, result }) => {
      await db
        .update("tool_call_logs")
        .set({ result })
        .where({ thread_id: threadId, name: toolName });
    },
    onFinish: async ({ text }) => {
      await db
        .insert("messages")
        .values({ thread_id: threadId, role: "assistant", content: text });
    },
  });

  return result.toAIStreamResponse();
}
```

#### Pulling tools from Postgres at run start

- Your `getRuntimeToolsForProject(projectId)` should fetch the installed components from Postgres and compile their JSON Schemas to tools (as in `03-AI-Tools-and-Schema.md`).
- Optionally, fetch blueprint-specific tools or feature flags from Postgres too.

#### Sandbox Realtime Preview (Vercel sandbox or E2B)

- For type-to-preview with minimal latency, use Supabase Realtime Broadcast channels keyed by `draftId`.
- Editor sends full snapshot per animation frame; preview applies last-write-wins by `version`.
- Persist to Postgres on save or on a slower cadence.

Client sketch:

```ts
// both editor and preview
const channel = supabase.channel(`draft:${draftId}`).subscribe();

// editor
channel.send({
  type: "broadcast",
  event: "snapshot",
  payload: { version, state },
});

// preview
let last = 0;
channel.on("broadcast", { event: "snapshot" }, ({ payload }) => {
  if (payload.version > last) {
    last = payload.version;
    applyState(payload.state);
  }
});
```

#### Vectors and RAG

- Use `pgvector` to index registry items (components/blueprints). A search tool can query Postgres and return ranked items for the assistant to install.

#### Background Work

- Offload long-running tasks (e.g., asset uploads, ingestion, batch migrations) to background jobs (e.g., Vercel cron/queues or a worker), while the AI SDK run remains snappy.

#### Security

- Gate tools per project/user, and validate access in tool executors.
- Don’t pass sensitive data via model messages; store files in Supabase Storage and fetch via signed URLs where needed.

#### Notes

- Keep this split: AI SDK 5 controls the interactive step-by-step flow; Supabase/Postgres owns persistence, retrieval, and real-time fan-out.
- MCP tools (e.g., Skyvern) can be merged into the AI SDK tool list per run; see `08-MCP-Integration-Skyvern.md`.
