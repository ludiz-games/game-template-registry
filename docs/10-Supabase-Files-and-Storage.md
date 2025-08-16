### Supabase Files and Storage

Supabase Storage will be our primary file store for images, screenshots, generated assets (9‑slice PNGs), and uploaded user files. This integrates cleanly with Postgres metadata and Supabase access controls.

#### Why Supabase Storage

- Integrated with Supabase auth/ACLs.
- Easy browser/server uploads via `@supabase/supabase-js`.
- Signed URLs or public buckets for delivery.

#### Tables (sketch)

```ts
// files(id uuid pk, owner_id uuid, file_name text, content_type text, size int, tags text[], path text, created_at timestamptz)
```

#### Upload helpers

```ts
// runtime/storage.ts
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";

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
  bucket?: string; // default "assets"
}) {
  const bucket = params.bucket ?? "assets";
  const path = `${params.ownerId}/${Date.now()}-${params.fileName}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, params.buffer, {
      contentType: params.contentType,
      upsert: false,
    });
  if (error) throw error;
  await db
    .insert("files")
    .values({
      owner_id: params.ownerId,
      file_name: params.fileName,
      content_type: params.contentType,
      size: params.buffer.byteLength,
      tags: params.tags,
      path,
    });
  const { data: signed } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);
  return { path, url: signed?.signedUrl };
}
```

#### Browser upload flow

```ts
// app/(client) example
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function uploadBrowserFile(
  file: File,
  meta: { ownerId: string; tags?: string[] }
) {
  const bucket = "assets";
  const path = `${meta.ownerId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  // Optionally persist metadata via an API route
  await fetch("/api/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      fileName: file.name,
      contentType: file.type,
      size: file.size,
      tags: meta.tags,
    }),
  });
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);
  return { path, url: data?.signedUrl };
}
```

#### Server‑side upload of generated buffers (tools, API routes)

```ts
// runtime/storage.ts (see uploadBufferToStorage above)
```

#### Using Supabase storage in design tools

- Replace local `public/` writes with `uploadBufferToStorage` in `design_remove_background`, `design_create_nine_slice`, and `design_screenshot_page` (when screenshots are taken server‑side).
- Return `{ path, url }` to the assistant. Persist references under the project so the preview can resolve a fresh signed URL when needed.

Example (excerpt):

```ts
// inside a tool execute() after producing a Buffer
import { uploadBufferToStorage } from "@/runtime/storage";

const { path, url } = await uploadBufferToStorage({
  buffer: buf,
  fileName: `bg-removed-${Date.now()}.png`,
  contentType: "image/png",
  ownerId: userId,
  tags: ["design", "bg-removed"],
});
return { path, url };
```

#### Serving files in the UI

- Use signed URLs or public buckets to render images or CSS that references images.
- Store only `path` (and metadata) in DB; never hard‑code the ephemeral URL.

#### Access control

- Gate upload and file metadata endpoints by user/project permissions.
- Optionally tag files with `projectId` and enforce checks in functions.
