### Design Toolchain

#### Goals

- **Accelerate design implementation** via a suite of deterministic tools the assistant can chain: generate hero/mood, extract elements from a reference, remove backgrounds, produce 9‑slice assets, apply theme tokens, screenshot, compare, and simulate flows.

#### Tools (runtime definitions)

```ts
// runtime/designTools.ts
import { z } from "zod";
import sharp from "sharp";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

type ToolsMap = Record<
  string,
  {
    description: string;
    parameters: z.ZodTypeAny;
    execute: (
      args: any,
      ctx: { projectId: string; baseUrl?: string; assetsDir?: string }
    ) => Promise<any>;
  }
>;

async function downloadToBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

async function saveAsset(buffer: Buffer, assetsDir: string, filename: string) {
  const dir = assetsDir;
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export function getDesignTools(): ToolsMap {
  return {
    design_generate_image: {
      description: "Generate a design image from a text prompt",
      parameters: z.object({
        prompt: z.string(),
        width: z.number().int().min(256).max(2048).default(1024),
        height: z.number().int().min(256).max(2048).default(768),
        style: z.string().optional(),
        seed: z.number().optional(),
      }),
      async execute(args) {
        const { prompt, width, height } = args;
        const res = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: {
            Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: "black-forest-labs/flux-1.1-pro",
            input: { prompt, width, height },
          }),
        }).then((r) => r.json());
        return { imageUrl: res.output?.[0] ?? null, raw: res };
      },
    },

    design_image_from_reference: {
      description: "Render an element from a reference image per instruction",
      parameters: z.object({
        referenceImageUrl: z.string().url(),
        instruction: z.string(),
        background: z
          .enum(["transparent", "white", "neutral"])
          .default("neutral"),
      }),
      async execute(args) {
        const { referenceImageUrl, instruction, background } = args;
        const res = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: {
            Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: "black-forest-labs/flux-1.1-pro",
            input: {
              prompt: `${instruction}. Background: ${background}`,
              image: referenceImageUrl,
            },
          }),
        }).then((r) => r.json());
        return { imageUrl: res.output?.[0] ?? null, raw: res };
      },
    },

    design_remove_background: {
      description: "Remove background from an image to get a transparent PNG",
      parameters: z.object({ imageUrl: z.string().url() }),
      async execute(args, ctx) {
        const { imageUrl } = args;
        const resp = await fetch("https://api.remove.bg/v1.0/removebg", {
          method: "POST",
          headers: { "X-Api-Key": process.env.REMOVE_BG_API_KEY! },
          body: (() => {
            const fd = new FormData();
            fd.set("image_url", imageUrl);
            fd.set("size", "auto");
            return fd;
          })(),
        });
        if (!resp.ok) throw new Error("Background removal failed");
        const buf = Buffer.from(await resp.arrayBuffer());
        const filename = `bg-removed-${crypto.randomUUID()}.png`;
        const filePath = await saveAsset(
          buf,
          ctx.assetsDir ?? "public/assets",
          filename
        );
        return { imagePath: filePath, publicPath: `/assets/${filename}` };
      },
    },

    design_create_nine_slice: {
      description: "Create a 9-slice asset and CSS from an input image",
      parameters: z.object({
        imageUrl: z.string().url(),
        slicePixels: z.object({
          top: z.number().int().min(0),
          right: z.number().int().min(0),
          bottom: z.number().int().min(0),
          left: z.number().int().min(0),
        }),
        outputName: z.string().min(1),
      }),
      async execute(args, ctx) {
        const { imageUrl, slicePixels, outputName } = args;
        const buf = await downloadToBuffer(imageUrl);
        const filename = `${outputName}.png`;
        const filePath = await saveAsset(
          buf,
          ctx.assetsDir ?? "public/assets/9slice",
          filename
        );
        const css = `
.nine-slice-${outputName} {
  border-style: solid;
  border-width: ${slicePixels.top}px ${slicePixels.right}px ${slicePixels.bottom}px ${slicePixels.left}px;
  -webkit-border-image: url('/assets/9slice/${filename}') ${slicePixels.top} ${slicePixels.right} ${slicePixels.bottom} ${slicePixels.left} fill stretch;
  border-image: url('/assets/9slice/${filename}') ${slicePixels.top} ${slicePixels.right} ${slicePixels.bottom} ${slicePixels.left} fill stretch;
}`;
        return {
          imagePath: filePath,
          className: `nine-slice-${outputName}`,
          css,
        };
      },
    },

    design_apply_theme_tokens: {
      description: "Apply CSS variables for theme tokens",
      parameters: z.object({ tokens: z.record(z.string(), z.string()) }),
      async execute(args) {
        const entries = Object.entries(args.tokens);
        const css = `:root{\n${entries
          .map(([k, v]) => `  --${k}: ${v};`)
          .join("\n")}\n}`;
        return { cssPatch: css };
      },
    },

    design_screenshot_page: {
      description: "Take a screenshot of a URL",
      parameters: z.object({
        url: z.string().url(),
        viewport: z
          .object({ width: z.number().int(), height: z.number().int() })
          .default({ width: 1280, height: 800 }),
        deviceScaleFactor: z.number().default(1),
      }),
      async execute(args, ctx) {
        const browser = await chromium.launch();
        const page = await browser.newPage({
          viewport: {
            ...args.viewport,
            deviceScaleFactor: args.deviceScaleFactor,
          },
        });
        await page.goto(args.url, { waitUntil: "networkidle" });
        const filename = `shot-${Date.now()}.png`;
        const outPath = path.join(ctx.assetsDir ?? "public/screens", filename);
        await fs.mkdir(path.dirname(outPath), { recursive: true });
        await page.screenshot({ path: outPath });
        await browser.close();
        return { imagePath: outPath, publicPath: `/screens/${filename}` };
      },
    },

    // design_visual_compare is not a tool. Visual self-check is performed via message injection (see below).

    design_simulate_user_flow: {
      description: "Open URL and run a sequence of user actions",
      parameters: z.object({
        url: z.string().url(),
        steps: z.array(
          z.discriminatedUnion("type", [
            z.object({ type: z.literal("click"), selector: z.string() }),
            z.object({
              type: z.literal("type"),
              selector: z.string(),
              text: z.string(),
            }),
            z.object({ type: z.literal("waitFor"), selector: z.string() }),
            z.object({
              type: z.literal("assertVisible"),
              selector: z.string(),
            }),
          ])
        ),
      }),
      async execute(args) {
        const browser = await chromium.launch();
        const page = await browser.newPage();
        await page.goto(args.url, { waitUntil: "domcontentloaded" });
        const logs: string[] = [];
        for (const step of args.steps) {
          if (step.type === "click") {
            await page.click(step.selector);
            logs.push(`clicked ${step.selector}`);
          } else if (step.type === "type") {
            await page.fill(step.selector, step.text);
            logs.push(`typed into ${step.selector}`);
          } else if (step.type === "waitFor") {
            await page.waitForSelector(step.selector, { state: "visible" });
            logs.push(`waited for ${step.selector}`);
          } else if (step.type === "assertVisible") {
            const visible = await page.isVisible(step.selector);
            if (!visible) throw new Error(`not visible: ${step.selector}`);
            logs.push(`asserted visible ${step.selector}`);
          }
        }
        await browser.close();
        return { logs };
      },
    },
  };
}
```

#### Chat Route with Design Tools

```ts
// app/api/chat/route.ts
import { NextRequest } from "next/server";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { getRuntimeToolsForProject } from "@/runtime/registryToolRuntime";
import { getDesignTools } from "@/runtime/designTools";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { projectId, userId, messages, baseUrl } = await req.json();
  const componentTools = await getRuntimeToolsForProject(projectId);
  const designTools = getDesignTools();

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

  const result = await streamText({
    model: openai("gpt-4o-mini"),
    messages,
    tools,
    toolChoice: "auto",
    maxSteps: 5,
  });

  return result.toAIStreamResponse();
}
```

#### Supabase Storage integration (optional)

If using Supabase Storage as the primary file store, replace local `public/` writes with a server-side upload helper. Ensure your tool execution context provides a `userId` for ownership.

```ts
// runtime/storage.ts (see full version in docs/10-Supabase-Files-and-Storage.md)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function uploadBufferToStorage(params: {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  ownerId: string;
  tags?: string[];
}) {
  const path = `${params.ownerId}/${Date.now()}-${params.fileName}`;
  const { error } = await supabase.storage
    .from("assets")
    .upload(path, params.buffer, { contentType: params.contentType });
  if (error) throw error;
  const { data } = await supabase.storage
    .from("assets")
    .createSignedUrl(path, 60 * 60);
  return { path, url: data?.signedUrl };
}
```

Examples using Supabase storage inside tools:

```ts
// In design_remove_background.execute
import { uploadBufferToStorage } from "@/runtime/storage";

const buf = Buffer.from(await resp.arrayBuffer());
const uploaded = await uploadBufferToStorage({
  buffer: buf,
  fileName: `bg-removed-${Date.now()}.png`,
  contentType: "image/png",
  ownerId: (ctx as any).userId,
  tags: ["design", "bg-removed"],
});
return { ...uploaded }; // { path, url }
```

```ts
// In design_create_nine_slice.execute
const buf = await downloadToBuffer(imageUrl);
const uploaded = await uploadBufferToStorage({
  buffer: buf,
  fileName: `${outputName}.png`,
  contentType: "image/png",
  ownerId: (ctx as any).userId,
  tags: ["design", "9slice"],
});
// Note: URLs are time-limited; store path and resolve a signed URL on render if needed.
const css = `
.nine-slice-${outputName} {
  border-style: solid;
  border-width: ${slicePixels.top}px ${slicePixels.right}px ${slicePixels.bottom}px ${slicePixels.left}px;
  /* Resolve the asset URL at render time for CSS-in-JS or inline styles */
}`;
return { ...uploaded, className: `nine-slice-${outputName}`, css };
```

```ts
// In design_screenshot_page.execute (buffer path)
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { ...args.viewport, deviceScaleFactor: args.deviceScaleFactor },
});
await page.goto(args.url, { waitUntil: "networkidle" });
const buf = await page.screenshot({ type: "png" });
await browser.close();

const uploaded = await uploadBufferToStorage({
  buffer: Buffer.from(buf),
  fileName: `shot-${Date.now()}.png`,
  contentType: "image/png",
  ownerId: (ctx as any).userId,
  tags: ["design", "screenshot"],
});
return { ...uploaded };
```

#### 9‑Slice CSS Example

```css
.nine-slice-button {
  border-style: solid;
  border-width: 16px 24px 20px 24px;
  -webkit-border-image: url("/assets/9slice/button.png") 16 24 20 24 fill
    stretch;
  border-image: url("/assets/9slice/button.png") 16 24 20 24 fill stretch;
}
```

#### Notes

- Run Playwright/screenshot tools on Node runtime.
- Store assets in object storage for production; in dev, `public/` is acceptable.
- Encourage the assistant to prefer deterministic tool steps (form/screenshot/compare) before further generative calls.

#### Visual self-check via message injection (no tool)

```ts
// runtime/visualSelfCheck.ts (example)
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export function injectVisualCheck(
  messages: { role: "system" | "user" | "assistant"; content: any }[],
  opts: {
    baselineUrl: string;
    candidateUrl: string;
    threshold?: number;
    criteria?: string;
  }
) {
  const threshold = opts.threshold ?? 0.85;
  return [
    ...messages,
    {
      role: "system",
      content:
        "When provided with a 'Design Visual Check', judge how closely the candidate matches the baseline. Return JSON {score: 0..1, pass: boolean, reasoning}.",
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Design Visual Check. Threshold = ${threshold}. ${
            opts.criteria
              ? `Criteria: ${opts.criteria}.`
              : "Focus on layout, typography, color palette, spacing, corner radii, iconography, and shadows."
          }`,
        },
        { type: "image", image: opts.baselineUrl },
        { type: "image", image: opts.candidateUrl },
      ],
    },
  ];
}
```

```ts
// app/api/chat/route.ts (snippet)
import { NextRequest } from "next/server";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { getRuntimeToolsForProject } from "@/runtime/registryToolRuntime";
import { getDesignTools } from "@/runtime/designTools";
import { injectVisualCheck } from "@/runtime/visualSelfCheck";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { projectId, userId, messages, baseUrl, visualCheck } =
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

  const result = await streamText({
    model: openai("gpt-4o-mini"),
    messages: msgs,
    tools,
    toolChoice: "auto",
    maxSteps: 5,
  });

  return result.toAIStreamResponse();
}
```
