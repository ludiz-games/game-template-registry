# Ludiz-Vibe Colyseus Server

This is the Colyseus multiplayer server for the Ludiz-Vibe project.

## Features

- **FullLLMRoom**: A multiplayer quiz room with Mars-themed questions
- **Shared Types**: Uses `@repo/colyseus-types` for type safety between client and server
- **Development Tools**: Includes playground and monitor for development

## Available Scripts

- `pnpm dev` - Start the server in development mode
- `pnpm build` - Build the server for production
- `pnpm start` - Start the production server
- `pnpm clean` - Clean the build directory

## Endpoints

- `http://localhost:2567/` - Colyseus Playground (development only)
- `http://localhost:2567/monitor` - Server Monitor
- `http://localhost:2567/hello_world` - Health check endpoint

## Room Types

### FullLLMRoom (`full-llm-demo`)

A multiplayer quiz room that supports up to 16 players. Features:

- Quiz questions about Mars
- Real-time scoring
- Timed questions (30 seconds each)
- Automatic progression through questions
- Player state management

## Usage

```typescript
import { Client } from "colyseus.js";
import { BaseState } from "@repo/colyseus-types";

const client = new Client("ws://localhost:2567");
const room = await client.joinOrCreate<BaseState>("full-llm-demo", {
  name: "Player1",
});

// Listen to state changes
room.onStateChange((state) => {
  console.log("Room state changed:", state);
});

// Send UI events
room.send("ui.event", { type: "answer.submit", choiceIndex: 1 });
```
