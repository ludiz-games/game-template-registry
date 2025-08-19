import jsonLogic from "json-logic-js";
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

  /**
   * Conditionally increment a numeric field if a provided value matches the value at a state path
   * Usage: {
   *   "type": "incrementIfEqual",
   *   "path": "players.${event.sessionId}.score",
   *   "equalsPath": "players.${event.sessionId}.currentQuestion.correctAnswer",
   *   "value": "${event.value}",
   *   "delta": 1
   * }
   */
  incrementIfEqual: (ctx: InterpreterContext, params: any) => {
    const { path, equalsPath, value, delta = 1 } = params || {};
    if (!path || !equalsPath) return;

    const expected = getByPath(ctx.state, equalsPath);
    const provided = value;

    if (expected != null && String(expected) === String(provided)) {
      const current = getByPath(ctx.state, path) || 0;
      const newValue = current + (typeof delta === "number" ? delta : 1);
      setByPath(ctx.state, path, newValue);
      console.log(
        `[Action] incrementIfEqual: matched. ${path} += ${delta} -> ${newValue}`
      );
    } else {
      console.log(
        `[Action] incrementIfEqual: no match. expected=${expected} provided=${provided}`
      );
    }
  },

  /**
   * Create an instance of a dynamic class from an item in a data array
   * Params: { className: string, statePath: string, arrayPath: string, index?: number, indexStatePath?: string }
   */
  createInstanceFromArray: (ctx: InterpreterContext, params: any) => {
    const { className, statePath, arrayPath, index, indexStatePath } =
      params || {};
    if (!className || !statePath || !arrayPath) return;

    const arr = getByPath(ctx.data, arrayPath);
    if (!Array.isArray(arr)) {
      console.warn(
        `[Action] createInstanceFromArray: data.${arrayPath} is not an array`
      );
      return;
    }

    let idx: number | undefined = undefined;
    if (typeof index === "number") idx = index;
    if (indexStatePath) {
      const fromState = getByPath(ctx.state, indexStatePath);
      if (typeof fromState === "number") idx = fromState;
    }
    if (idx == null || idx < 0 || idx >= arr.length) {
      console.warn(
        `[Action] createInstanceFromArray: invalid index for ${arrayPath}: ${idx}`
      );
      return;
    }

    const dataItem = arr[idx];
    const dynamicClasses = (ctx.room as any).dynamicClasses;
    const Ctor = dynamicClasses?.get?.(className);
    if (!Ctor) {
      console.warn(
        `[Action] createInstanceFromArray: class '${className}' not found`
      );
      return;
    }
    const instance = new Ctor();
    Object.assign(instance, dataItem);
    setByPath(ctx.state, statePath, instance);
    console.log(
      `[Action] createInstanceFromArray: set ${statePath} from ${arrayPath}[${idx}]`
    );
  },

  /**
   * Schedule a list of actions to execute after a delay
   * Params: { delayMs: number, actions: Array<{ type: string, ...params }> }
   */
  scheduleActions: (ctx: InterpreterContext, params: any) => {
    const delayMs: number = Number(params?.delayMs ?? 0);
    const actions: any[] = Array.isArray(params?.actions) ? params.actions : [];
    if (!actions.length) return;

    setTimeout(() => {
      try {
        for (const action of actions) {
          const { type: actionType, ...rest } = action || {};
          const fn = (standardActions as any)[actionType];
          if (typeof fn === "function") {
            fn(ctx, rest);
          } else {
            console.warn(
              `[Action] scheduleActions: unknown action '${actionType}'`
            );
          }
        }
      } catch (e) {
        console.error("[Action] scheduleActions error:", e);
      }
    }, delayMs);

    console.log(
      `[Action] scheduleActions: scheduled ${actions.length} action(s) in ${delayMs}ms`
    );
  },

  /**
   * Set a state path from an item in a data array (optionally a specific key)
   * Params: { statePath: string, arrayPath: string, key?: string, index?: number, indexStatePath?: string }
   */
  setFromArray: (ctx: InterpreterContext, params: any) => {
    const { statePath, arrayPath, key, index, indexStatePath } = params || {};
    if (!statePath || !arrayPath) return;

    const arr = getByPath(ctx.data, arrayPath);
    if (!Array.isArray(arr)) {
      console.warn(`[Action] setFromArray: data.${arrayPath} is not an array`);
      return;
    }

    let idx: number | undefined = undefined;
    if (typeof index === "number") idx = index;
    if (indexStatePath) {
      const fromState = getByPath(ctx.state, indexStatePath);
      if (typeof fromState === "number") idx = fromState;
    }
    if (idx == null || idx < 0 || idx >= arr.length) {
      console.warn(
        `[Action] setFromArray: invalid index for ${arrayPath}: ${idx}`
      );
      return;
    }

    const item = arr[idx];
    const value = key ? item?.[key] : item;
    setByPath(ctx.state, statePath, value);
    console.log(
      `[Action] setFromArray: ${statePath} <= ${arrayPath}[${idx}]${
        key ? "." + key : ""
      }`
    );
  },

  /**
   * Conditionally run actions using JSONLogic
   * Params: { cond: object, then?: Action[], else?: Action[] }
   */
  when: (ctx: InterpreterContext, params: any) => {
    const cond = params?.cond;
    const thenActions: any[] = Array.isArray(params?.then) ? params.then : [];
    const elseActions: any[] = Array.isArray(params?.else) ? params.else : [];

    // Use a plain JSON snapshot for JSONLogic compatibility (handles MapSchema, Schema)
    const statePlain =
      ctx.state && (ctx.state as any).toJSON
        ? (ctx.state as any).toJSON()
        : ctx.state;
    const data = {
      state: statePlain,
      data: ctx.data,
      context: ctx.context,
    };

    const result = cond ? jsonLogic.apply(cond, data) : true;
    const actionsToRun = result ? thenActions : elseActions;

    for (const action of actionsToRun) {
      const { type: actionType, ...rest } = action || {};
      const fn = (standardActions as any)[actionType];
      if (typeof fn === "function") {
        fn(ctx, rest);
      } else {
        console.warn(`[Action] when: unknown action '${actionType}'`);
      }
    }
    console.log(`[Action] when: cond=${JSON.stringify(cond)} => ${result}`);
  },

  /**
   * Ensure an instance exists at a given state path, creating from a dynamic class
   * Params: { className: string, statePath: string, data?: object }
   */
  ensureInstanceAtPath: (ctx: InterpreterContext, params: any) => {
    const { className, statePath, data } = params || {};
    if (!className || !statePath) return;

    const dynamicClasses = (ctx.room as any).dynamicClasses;
    const ClassConstructor = dynamicClasses?.get?.(className);
    if (!ClassConstructor) {
      console.warn(
        `[Action] ensureInstanceAtPath: class '${className}' not found`
      );
      return;
    }

    const existing = getByPath(ctx.state, statePath);
    if (existing) return;

    const instance = new ClassConstructor();
    if (data && typeof data === "object") {
      Object.assign(instance, data);
    }
    setByPath(ctx.state, statePath, instance);
    console.log(
      `[Action] ensureInstanceAtPath: created ${className} at ${statePath}`
    );
  },
};
