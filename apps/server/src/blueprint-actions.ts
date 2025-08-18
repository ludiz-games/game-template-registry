import { getByPath, setByPath } from "./path-utils.js";
import type {
  ActionImplementations,
  InterpreterContext,
} from "./xstate-interpreter.js";

/**
 * Generic action implementations that any blueprint can use.
 * These are safe, whitelisted operations with no game-specific logic.
 */
export const standardActions: ActionImplementations = {
  /**
   * Set a field on the replicated state
   * Usage in machine: { "actions": [{ "type": "setState", "path": "phase", "value": "question" }] }
   */
  setState: (ctx: InterpreterContext, params: any) => {
    const { path, value } = params || {};
    if (path && value !== undefined) {
      setByPath(ctx.state, path, value);
      console.log(`[Action] setState: ${path} = ${value}`);
    }
  },

  /**
   * Increment a numeric field
   * Usage: { "type": "increment", "path": "stepIndex", "delta": 1 }
   */
  increment: (ctx: InterpreterContext, params: any) => {
    const { path, delta = 1 } = params || {};
    if (path) {
      const current = getByPath(ctx.state, path) || 0;
      const newValue = current + delta;
      setByPath(ctx.state, path, newValue);
      console.log(`[Action] increment: ${path} by ${delta} = ${newValue}`);
    }
  },

  /**
   * Set a field from data using JSONPath
   * Usage: { "type": "setFromData", "statePath": "current.question", "dataPath": "steps.0.data.question" }
   */
  setFromData: (ctx: InterpreterContext, params: any) => {
    const { statePath, dataPath } = params || {};
    if (statePath && dataPath) {
      const value = getByPath(ctx.data, dataPath);
      setByPath(ctx.state, statePath, value);
      console.log(
        `[Action] setFromData: ${statePath} = ${value} (from ${dataPath})`
      );
    }
  },

  /**
   * Create and set an object instance from a class
   * Usage: { "type": "createInstance", "className": "QuestionView", "statePath": "current", "data": {...} }
   */
  createInstance: (ctx: InterpreterContext, params: any) => {
    const { className, statePath, data } = params || {};
    if (className && statePath && (ctx.room as any).dynamicClasses?.get) {
      const ClassConstructor = (ctx.room as any).dynamicClasses.get(className);
      if (ClassConstructor) {
        const instance = new ClassConstructor();

        // Set properties from data
        if (data) {
          Object.assign(instance, data);
        }

        setByPath(ctx.state, statePath, instance);
        console.log(
          `[Action] createInstance: Created ${className} at ${statePath}`
        );
      }
    }
  },

  /**
   * Broadcast a message to all clients
   * Usage: { "type": "broadcast", "event": "quiz.finished", "data": {...} }
   */
  broadcast: (ctx: InterpreterContext, params: any) => {
    const { event, data } = params || {};
    if (event) {
      ctx.room.broadcast(event, data);
      console.log(`[Action] broadcast: ${event}`, data);
    }
  },

  /**
   * Log a message (useful for debugging)
   * Usage: { "type": "log", "message": "Game started!" }
   */
  log: (ctx: InterpreterContext, params: any) => {
    const { message } = params || {};
    console.log(`[Action] log: ${message}`);
  },
};
