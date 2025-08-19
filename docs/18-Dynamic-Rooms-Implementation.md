# Dynamic Rooms Implementation - Complete

## 🎯 Status: COMPLETED ✅

We have successfully implemented a **100% generic, JSON-driven Colyseus dynamic room system** with runtime schema generation, XState integration, and robust token templating.

## 🏗️ Architecture Overview

### Core Components

1. **GenericRoom** (`apps/server/src/rooms/GenericRoom.ts`)
   - Single room type that hosts all game instances
   - Loads game definitions at runtime from JSON
   - No hardcoded game logic - pure data-driven architecture

2. **Runtime Schema Generation** (`apps/server/src/schema-builder.ts`)
   - Dynamically creates Colyseus `Schema` classes from JSON DSL
   - Eliminates need for generic `extNum`/`extStr` maps
   - Type-safe replicated state tailored to each game

3. **XState Integration** (`apps/server/src/xstate-interpreter.ts`)
   - Industry-standard state machine interpreter
   - JSONLogic for conditional logic in pure JSON
   - Replaces custom state machine implementations

4. **Generic Actions** (`apps/server/src/runtime-actions.ts`)
   - Whitelisted, composable actions: `setState`, `increment`, `createInstance`, etc.
   - No game-specific logic - works for any game type
   - MapSchema-aware path utilities for proper Colyseus replication

5. **Token Templating** (`apps/server/src/template.ts`)
   - Mustache-based token resolution: `${event.sessionId}`, `${state.phase}`
   - Works in any action parameter (strings, objects, arrays)
   - Clean separation from action logic

## 📋 Game Definition Format

Games are defined as pure JSON with three main sections:

### Schema Definition

```json
{
  "schema": {
    "root": "State",
    "classes": {
      "Player": {
        "name": { "type": "string" },
        "score": { "type": "number" }
      },
      "Question": {
        "text": { "type": "string" },
        "answer": { "type": "string" }
      },
      "State": {
        "phase": { "type": "string" },
        "currentQuestion": { "ref": "Question" },
        "players": { "map": "Player" }
      }
    },
    "defaults": {
      "State": { "phase": "waiting" },
      "Player": { "name": "Player", "score": 0 }
    }
  }
}
```

### State Machine Definition

```json
{
  "machine": {
    "id": "simple-quiz",
    "initial": "waiting",
    "states": {
      "waiting": {
        "on": {
          "start": {
            "target": "playing",
            "actions": [
              { "type": "setState", "path": "phase", "value": "playing" },
              {
                "type": "createInstance",
                "className": "Question",
                "statePath": "currentQuestion",
                "data": { "text": "What is 2+2?", "answer": "4" }
              },
              { "type": "log", "message": "Game started!" }
            ]
          }
        }
      },
      "playing": {
        "on": {
          "answer": [
            {
              "cond": {
                "==": [
                  { "var": "event.value" },
                  { "var": "state.currentQuestion.answer" }
                ]
              },
              "actions": [
                { "type": "log", "message": "Correct answer!" },
                {
                  "type": "increment",
                  "path": "players.${event.sessionId}.score",
                  "delta": 10
                },
                { "type": "setState", "path": "phase", "value": "finished" }
              ]
            },
            {
              "actions": [
                { "type": "log", "message": "Wrong answer!" },
                { "type": "setState", "path": "phase", "value": "finished" }
              ]
            }
          ]
        }
      }
    }
  }
}
```

## 🔧 Technical Implementation

### 1. Runtime Schema Generation

- **Input**: JSON DSL describing classes and their fields
- **Output**: Colyseus `Schema` classes with proper decorators
- **Benefits**: Type-safe, game-specific schemas without code generation

### 2. XState + JSONLogic Integration

- **XState v5**: Battle-tested state machine library
- **JSONLogic**: Pure JSON conditional logic
- **Guards**: `{ "==": [{ "var": "event.value" }, { "var": "state.answer" }] }`
- **Actions**: Composable, generic operations

### 3. Token Resolution

- **Mustache.js**: Robust templating engine
- **Context**: `{ event, state, context, data }`
- **Usage**: `players.${event.sessionId}.score` → `players.abc123.score`

### 4. MapSchema-Aware Path Utilities

- **Problem**: lodash.set doesn't work with Colyseus MapSchema
- **Solution**: Custom path utilities that detect Map-like objects
- **Result**: Generic actions work with any nested structure

## 🎮 Working Demo

### Server Components

- **GenericRoom**: Registers as `"project"` room type
- **Definition Loading**: Loads JSON from client or server file
- **Message Handlers**: Dynamically registers handlers for all events in state machine
- **State Replication**: Full Colyseus state synchronization

### Client Integration

- **Connection**: `client.joinOrCreate("project", { definitionId: "simple-quiz", definition: DEMO_DEFINITION })`
- **State Updates**: `Object.assign({}, newState)` for React change detection
- **Message Sending**: `room.send("start")`, `room.send("answer", { value: "4" })`

## 🚀 Key Achievements

### 1. Zero Hardcoded Logic ✅

- No game-specific code in server
- All logic defined in JSON definitions
- Generic actions work for any game type

### 2. Runtime Schema Generation ✅

- No `extNum`/`extStr` generic maps
- Type-safe, game-specific schemas
- Proper Colyseus replication

### 3. Industry Standard Libraries ✅

- XState for state machines (not custom interpreter)
- JSONLogic for conditions
- Mustache for templating
- lodash utilities for path operations

### 4. Robust Token System ✅

- Works in any action parameter
- Supports complex nested structures
- Clean separation from business logic

### 5. MapSchema Compatibility ✅

- Custom path utilities handle Colyseus MapSchema
- Generic actions work with Map-like objects
- Proper change detection and replication

## 📁 File Structure

```
apps/server/src/
├── rooms/
│   └── GenericRoom.ts          # Main dynamic room implementation
├── definition-loader.ts        # Loads game definitions from JSON
├── runtime-actions.ts          # Generic, whitelisted actions
├── schema-builder.ts           # Runtime Schema class generation
├── xstate-interpreter.ts       # XState + JSONLogic integration
├── template.ts                 # Mustache token resolution
└── path-utils.ts              # MapSchema-aware path utilities
```

## 🔄 Message Flow

1. **Client connects**: `joinOrCreate("project", { definition: {...} })`
2. **Server loads definition**: Validates JSON structure
3. **Schema generation**: Creates runtime Colyseus classes
4. **State machine setup**: XState interpreter with JSONLogic guards
5. **Message handlers**: Dynamic registration based on state machine events
6. **Game play**: Events trigger state transitions and generic actions
7. **State replication**: Colyseus synchronizes state to all clients

## 🎯 Benefits Achieved

### For Developers

- **No Colyseus expertise required**: Define games in pure JSON
- **Rapid iteration**: Change game logic without server restarts
- **Type safety**: Runtime schemas provide proper typing
- **Debugging**: XState devtools and extensive logging

### For System Architecture

- **Multi-tenant**: Single room type hosts all games
- **Scalable**: No per-game server code
- **Maintainable**: Generic actions reduce code duplication
- **Secure**: Whitelisted actions prevent arbitrary code execution

### For Game Design

- **Flexible**: Any game logic expressible in state machines
- **Composable**: Actions can be combined for complex behaviors
- **Testable**: Pure JSON definitions are easy to test
- **Versionable**: Definitions can be versioned and migrated

## 🧪 Testing Results

### Functionality ✅

- Game starts correctly from `waiting` → `playing`
- Questions are created and displayed
- Answer validation works with JSONLogic conditions
- Scores increment properly on correct answers
- State transitions to `finished` after answer

### Performance ✅

- Runtime schema generation is fast
- XState interpreter has minimal overhead
- Token resolution is efficient
- MapSchema path utilities work correctly

### Reliability ✅

- No hardcoded paths or game-specific logic
- Robust error handling and validation
- Proper TypeScript types throughout
- Clean separation of concerns

## 🔮 Future Extensions

The system is designed to support:

1. **Complex Games**: Multi-step workflows, branching narratives
2. **Real-time Features**: Timers, live updates, spectator modes
3. **Advanced Logic**: Nested conditions, complex scoring systems
4. **Custom Actions**: Game-specific actions via plugin system
5. **Visual Editors**: GUI tools for creating state machines

## 📚 Documentation

- **Architecture**: This document
- **API Reference**: Inline TypeScript types and JSDoc
- **Examples**: Working quiz demo in `apps/game/`
- **Schemas**: JSON Schema definitions for validation

## Blueprint Patterns

The generic action system supports two main multiplayer patterns:

### Per-Player Independent Flow

Each player progresses through their own state independently. The leaderboard remains shared, but individual progress (current question, phase, timer) is isolated.

**Schema Structure:**

```json
{
  "Player": {
    "name": { "type": "string" },
    "score": { "type": "number" },
    "phase": { "type": "string" },
    "currentQuestion": { "ref": "Question" },
    "questionIndex": { "type": "number" },
    "timeLeft": { "type": "number" },
    "showFeedback": { "type": "boolean" }
  },
  "State": {
    "players": { "map": "Player" }
  }
}
```

**Action Pattern:**

```json
{
  "type": "setState",
  "path": "players.${event.sessionId}.phase",
  "value": "question"
}
```

**Use Cases:** Quiz games, individual puzzles, turn-based games where players move at their own pace.

### Global Synchronized Flow

All players see the same state and progress together through synchronized phases.

**Schema Structure:**

```json
{
  "Player": {
    "name": { "type": "string" },
    "score": { "type": "number" }
  },
  "State": {
    "players": { "map": "Player" },
    "globalPhase": { "type": "string" },
    "currentQuestion": { "ref": "Question" },
    "timeLeft": { "type": "number" }
  }
}
```

**Action Pattern:**

```json
{
  "type": "setState",
  "path": "globalPhase",
  "value": "question"
}
```

**Use Cases:** Live trivia shows, synchronized presentations, real-time collaborative games.

### Hybrid Patterns

You can combine both patterns:

- Global timer and question progression
- Per-player answer tracking and scoring
- Shared results and leaderboards

```json
{
  "actions": [
    {
      "type": "setState",
      "path": "globalPhase",
      "value": "question"
    },
    {
      "type": "incrementIfEqual",
      "path": "players.${event.sessionId}.score",
      "equalsPath": "currentQuestion.correctAnswer",
      "value": "${event.value}",
      "delta": 1
    }
  ]
}
```

## 🎉 Conclusion

We have successfully built a **production-ready, generic Colyseus dynamic room system** that:

- ✅ Eliminates hardcoded game logic
- ✅ Uses industry-standard libraries (XState, JSONLogic)
- ✅ Generates runtime schemas without `extNum` hacks
- ✅ Provides robust token templating
- ✅ Supports both per-player and synchronized multiplayer patterns
- ✅ Works with any game type definable as a state machine
- ✅ Maintains full type safety and Colyseus compatibility

The system is ready for production use and can support the full range of multiplayer games envisioned in the project roadmap.
