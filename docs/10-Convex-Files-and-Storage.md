### Convex Files and Storage

Convex Storage will be our primary file store for images, screenshots, generated assets (9‑slice PNGs), and uploaded user files. This integrates cleanly with Convex real‑time state and access control.

#### Why Convex Storage

- First‑class integration with Convex functions and access rules.
- Easy browser/server uploads via `generateUploadUrl`.
- Short‑lived public URLs via `storage.getUrl(storageId)` for delivery.

#### Tables (sketch)

```ts
// convex/schema.ts (add alongside your other tables)
export type File = {
  _id: string;
  storageId: string; // _storage id
  ownerId: string; // users id
  fileName: string;
  contentType: string;
  size?: number;
  tags?: string[]; // e.g., ["design", "screenshot", "asset"]
  createdAt: number;
};
```

#### Convex functions

```ts
// convex/files.ts
import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const recordUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    ownerId: v.string(),
    fileName: v.string(),
    contentType: v.string(),
    size: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("files", { ...args, createdAt: Date.now() });
  },
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});

export const deleteFile = mutation({
  args: { storageId: v.id("_storage"), fileId: v.id("files") },
  handler: async (ctx, { storageId, fileId }) => {
    await ctx.storage.delete(storageId);
    await ctx.db.delete(fileId);
  },
});
```

#### Browser upload flow

```ts
// app/(client) example
async function uploadBrowserFile(
  file: File,
  meta: { ownerId: string; tags?: string[] }
) {
  // 1) Ask Convex for an upload URL
  const uploadUrl = await convex.actions.files.generateUploadUrl();

  // 2) POST file bytes to Convex storage
  const post = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  const { storageId } = await post.json();

  // 3) Record metadata
  const fileId = await convex.mutations.files.recordUpload({
    storageId,
    ownerId: meta.ownerId,
    fileName: file.name,
    contentType: file.type,
    size: file.size,
    tags: meta.tags,
  });

  return { fileId, storageId };
}
```

#### Server‑side upload of generated buffers (tools, API routes)

```ts
// runtime/convexStorage.ts
import { convex } from "@/lib/convexClient";

export async function uploadBufferToConvex(params: {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  ownerId: string;
  tags?: string[];
}) {
  const { buffer, fileName, contentType, ownerId, tags } = params;
  const uploadUrl = await convex.actions.files.generateUploadUrl();
  const post = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: buffer,
  });
  if (!post.ok) throw new Error("Convex upload failed");
  const { storageId } = await post.json();

  const fileId = await convex.mutations.files.recordUpload({
    storageId,
    ownerId,
    fileName,
    contentType,
    size: buffer.byteLength,
    tags,
  });

  const url = await convex.queries.files.getFileUrl({ storageId });
  return { fileId, storageId, url };
}
```

#### Using Convex storage in design tools

- Replace local `public/` writes with `uploadBufferToConvex` in `design_remove_background`, `design_create_nine_slice`, and `design_screenshot_page` (when screenshots are taken server‑side).
- Return `{ storageId, fileId, url }` to the assistant. Persist references under the project so the preview can fetch a fresh URL via `files.getFileUrl` when needed.

Example (excerpt):

```ts
// inside a tool execute() after producing a Buffer
import { uploadBufferToConvex } from "@/runtime/convexStorage";

const { fileId, storageId, url } = await uploadBufferToConvex({
  buffer: buf,
  fileName: `bg-removed-${Date.now()}.png`,
  contentType: "image/png",
  ownerId: userId,
  tags: ["design", "bg-removed"],
});
return { fileId, storageId, url };
```

#### Serving files in the UI

- Use `files.getFileUrl(storageId)` to retrieve a time‑limited URL when rendering images or CSS that references images.
- Store only `storageId` (and metadata) in DB; never hard‑code the ephemeral URL.

#### Access control

- Gate `generateUploadUrl`, `recordUpload`, `getFileUrl`, and `deleteFile` by user/project permissions.
- Optionally tag files with `projectId` and enforce checks in functions.
