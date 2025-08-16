### Sandbox Realtime (Editor ↔ Preview)

Goal: instant type-to-preview updates while editing a game with a remote sandbox (Vercel or E2B).

#### Recommendation

- Use Supabase Realtime Broadcast channels keyed by `draftId` (or `projectId:sessionId`).
- Send full snapshots per animation frame (no patching needed). Include a monotonically increasing `version`.
- Persist to Postgres on save or a slower cadence (e.g., 1–2s) to avoid write amplification.

#### Client wiring

```ts
// both editor and preview
const channel = supabase.channel(`draft:${draftId}`).subscribe();

// editor: send per frame
let version = 0;
let pending: any = null;
let scheduled = false;
function queue(state: any) {
  pending = state;
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      channel.send({
        type: "broadcast",
        event: "snapshot",
        payload: { version: ++version, state: pending },
      });
      pending = null;
    });
  }
}

// preview: last-write-wins
let last = 0;
channel.on("broadcast", { event: "snapshot" }, ({ payload }) => {
  if (payload.version > last) {
    last = payload.version;
    applyState(payload.state);
  }
});
```

#### Auth

- Generate a short-lived `previewToken` (JWT) containing `userId`, `draftId`, and `exp`. Provide it to the preview (E2B/iframe) via URL param or header.
- Use Supabase client with that token to join the channel. Gate server-side persistence APIs with Better Auth.

#### Scaling

- Supabase Realtime handles multi-instance fan-out. If moving to a custom relay later, mirror the channel API via SSE/WebSocket + Redis Pub/Sub.
