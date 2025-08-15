### Agentic UI Testing (Autopilot)

#### Goal

- Allow the assistant to autonomously explore and test the app (navigate, click, type, assert) without hardcoded step scripts. The assistant decides actions based on the current UI state and its knowledge of generated code.

#### Approach

- Provide a minimal set of atomic browser tools and let the model plan in a loop (Plan → Act → Observe → Repeat). The tools target accessibility-first locators and return compact state summaries to avoid token bloat.
- Optional: expose the same capabilities via an MCP server and register them in the AI runtime as remote tools.

#### Atomic Browser Tools (runtime)

```ts
// runtime/browserTools.ts
import { z } from "zod";
import { chromium, Page } from "playwright";

type Ctx = { baseUrl?: string };

let cachedPage: Page | undefined;

async function getPage() {
  if (cachedPage) return cachedPage;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  cachedPage = page;
  return page;
}

async function summarize(page: Page) {
  const url = page.url();
  const title = await page.title();
  const controls = await page.$$eval(
    'button, a, [role="button"], input, select, textarea',
    (els) =>
      els.slice(0, 64).map((el) => ({
        role: (el.getAttribute("role") || el.tagName).toLowerCase(),
        name: (
          el.getAttribute("aria-label") ||
          (el as any).innerText ||
          ""
        ).slice(0, 80),
        id: el.id || undefined,
        testid: el.getAttribute("data-testid") || undefined,
      }))
  );
  return { url, title, controls };
}

export function getBrowserTools() {
  return {
    browser_navigate: {
      description: "Navigate to a URL (must be same-origin as baseUrl).",
      parameters: z.object({ url: z.string().url() }),
      execute: async (args: { url: string }, ctx: Ctx) => {
        const page = await getPage();
        const allow = ctx.baseUrl ? args.url.startsWith(ctx.baseUrl) : true;
        if (!allow) throw new Error("Blocked navigation: not in allowlist");
        await page.goto(args.url, { waitUntil: "domcontentloaded" });
        return summarize(page);
      },
    },

    browser_state: {
      description:
        "Return current URL, title, and a compact list of visible controls (role/name/id/testid).",
      parameters: z.object({}),
      execute: async () => {
        const page = await getPage();
        return summarize(page);
      },
    },

    browser_click: {
      description: "Click by role/name, text, testid, or CSS selector.",
      parameters: z.object({
        by: z.enum(["role", "text", "testid", "selector"]).default("role"),
        role: z.string().optional(),
        name: z.string().optional(),
        text: z.string().optional(),
        testid: z.string().optional(),
        selector: z.string().optional(),
      }),
      execute: async (args) => {
        const page = await getPage();
        if (args.by === "role" && args.role && args.name) {
          await page
            .getByRole(args.role as any, { name: new RegExp(args.name, "i") })
            .click();
        } else if (args.by === "text" && args.text) {
          await page.getByText(new RegExp(args.text, "i")).click();
        } else if (args.by === "testid" && args.testid) {
          await page.locator(`[data-testid="${args.testid}"]`).click();
        } else if (args.by === "selector" && args.selector) {
          await page.click(args.selector);
        } else {
          throw new Error("Invalid click arguments");
        }
        return summarize(page);
      },
    },

    browser_type: {
      description:
        "Type text into an input by placeholder, label (text), testid, or selector.",
      parameters: z.object({
        by: z
          .enum(["placeholder", "label", "testid", "selector"])
          .default("placeholder"),
        value: z.string(),
        placeholder: z.string().optional(),
        label: z.string().optional(),
        testid: z.string().optional(),
        selector: z.string().optional(),
      }),
      execute: async (args) => {
        const page = await getPage();
        if (args.by === "placeholder" && args.placeholder) {
          await page
            .getByPlaceholder(new RegExp(args.placeholder, "i"))
            .fill(args.value);
        } else if (args.by === "label" && args.label) {
          await page.getByLabel(new RegExp(args.label, "i")).fill(args.value);
        } else if (args.by === "testid" && args.testid) {
          await page.locator(`[data-testid="${args.testid}"]`).fill(args.value);
        } else if (args.by === "selector" && args.selector) {
          await page.fill(args.selector, args.value);
        } else {
          throw new Error("Invalid type arguments");
        }
        return summarize(page);
      },
    },

    browser_wait_for: {
      description:
        "Wait for an element by role/name, text, testid, or selector to be visible.",
      parameters: z.object({
        by: z.enum(["role", "text", "testid", "selector"]).default("role"),
        role: z.string().optional(),
        name: z.string().optional(),
        text: z.string().optional(),
        testid: z.string().optional(),
        selector: z.string().optional(),
        timeoutMs: z.number().int().min(0).max(30000).default(5000),
      }),
      execute: async (args) => {
        const page = await getPage();
        if (args.by === "role" && args.role && args.name) {
          await page
            .getByRole(args.role as any, { name: new RegExp(args.name, "i") })
            .waitFor({ state: "visible", timeout: args.timeoutMs });
        } else if (args.by === "text" && args.text) {
          await page
            .getByText(new RegExp(args.text, "i"))
            .waitFor({ state: "visible", timeout: args.timeoutMs });
        } else if (args.by === "testid" && args.testid) {
          await page
            .locator(`[data-testid="${args.testid}"]`)
            .waitFor({ state: "visible", timeout: args.timeoutMs });
        } else if (args.by === "selector" && args.selector) {
          await page.waitForSelector(args.selector, {
            state: "visible",
            timeout: args.timeoutMs,
          });
        } else {
          throw new Error("Invalid wait_for arguments");
        }
        return summarize(page);
      },
    },

    browser_screenshot: {
      description: "Capture a screenshot and return path and summary.",
      parameters: z.object({
        path: z.string().default(`public/screens/auto-${Date.now()}.png`),
      }),
      execute: async (args) => {
        const page = await getPage();
        await page.screenshot({ path: args.path });
        return { ...(await summarize(page)), screenshotPath: args.path };
      },
    },

    browser_close: {
      description: "Close the current page (ends the session).",
      parameters: z.object({}),
      execute: async () => {
        if (cachedPage) {
          await cachedPage.context().browser()?.close();
          cachedPage = undefined;
        }
        return { closed: true };
      },
    },
  } as const;
}
```

#### Chat Wiring (agentic loop)

```ts
// app/api/agent/route.ts
import { NextRequest } from "next/server";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { getBrowserTools } from "@/runtime/browserTools";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { baseUrl, goal, messages = [] } = await req.json();
  const tools = Object.fromEntries(
    Object.entries(getBrowserTools()).map(([name, def]) => [
      name,
      {
        description: def.description,
        parameters: def.parameters,
        execute: (args: any) => def.execute(args, { baseUrl }),
      },
    ])
  );

  const sys = {
    role: "system" as const,
    content:
      "You are a UI autopilot. Use only the provided browser_* tools to achieve the user's goal. Prefer accessibility-based locators (role/name) and minimal steps. Always reflect after each observation.",
  };

  const user = { role: "user" as const, content: `Goal: ${goal}` };

  const result = await streamText({
    model: openai("gpt-4o-mini"),
    messages: [sys, ...messages, user],
    tools,
    toolChoice: "auto",
    maxSteps: 20,
  });

  return result.toAIStreamResponse();
}
```

#### App Instrumentation

- Expose `data-testid` and meaningful roles/names.
- Keep `data-component-instance-id` for component instances.
- Add accessible names to interactive controls (`aria-label`, button text).

#### MCP Option (outline)

- Wrap the same actions in a separate MCP server process exposing JSON-RPC methods (navigate, state, click, type, wait_for, screenshot, close).
- Register the MCP tools with the model runtime; use the same agentic loop. This allows swapping in different browsers/backends without changing the assistant.

#### Safety

- Enforce allowlisted `baseUrl` and host.
- Cap max steps and timeouts; require explicit user confirmation for destructive actions.

#### Notes

- The older `design_simulate_user_flow` scripted tool can remain as a fallback for deterministic demos, but prefer the agentic autopilot above for real projects.
