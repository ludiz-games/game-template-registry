# @ludiz/colyseus-hooks

React hooks for [Colyseus](https://colyseus.io) real-time multiplayer framework.

## Installation

```bash
npm install @ludiz/colyseus-hooks colyseus.js @colyseus/schema
```

## Usage

```tsx
import { colyseus } from "@ludiz/colyseus-hooks";
import { Schema } from "@colyseus/schema";

// Define your state schema
class GameState extends Schema {
  // your schema properties
}

function GameComponent() {
  const { connectToColyseus, useColyseusRoom, useColyseusState } =
    colyseus<GameState>("ws://localhost:2567", GameState);

  const room = useColyseusRoom();
  const state = useColyseusState();

  // Connect to room
  useEffect(() => {
    connectToColyseus("my-room", { playerName: "Alice" });
  }, [connectToColyseus]);

  // Handle messages
  useEffect(() => {
    if (!room) return;

    room.onMessage("game-event", (payload) => {
      console.log("Received:", payload);
    });
  }, [room]);

  // Send messages
  const sendAction = () => {
    room?.send("player-action", { type: "move", direction: "up" });
  };

  return (
    <div>
      <div>Room: {room?.roomId}</div>
      <div>State: {state?.phase}</div>
      <button onClick={sendAction}>Send Action</button>
    </div>
  );
}
```

## API

### `colyseus<T>(endpoint, schema?)`

Creates a Colyseus instance with React hooks.

**Parameters:**

- `endpoint` - WebSocket endpoint (e.g., `'ws://localhost:2567'`)
- `schema` - Optional Colyseus schema class

**Returns:**

- `connectToColyseus(roomName, options)` - Connect to a room
- `disconnectFromColyseus()` - Disconnect from current room
- `useColyseusRoom()` - Hook to get current room instance
- `useColyseusState()` - Hook to get current room state

### `useColyseusRoom()`

Returns the current Colyseus room instance or `undefined` if not connected.

### `useColyseusState(selector?)`

Returns the current room state. Optionally accepts a selector function for derived state.

```tsx
// Get full state
const state = useColyseusState();

// Get derived state
const playerCount = useColyseusState((state) => state.players.size);
```

## Features

- ✅ **Type-safe** - Full TypeScript support
- ✅ **Reactive** - Automatic re-renders on state changes
- ✅ **Efficient** - Uses `useSyncExternalStore` for optimal performance
- ✅ **Simple** - Clean, intuitive API
- ✅ **Reliable** - Handles connection lifecycle automatically

## License

MIT
