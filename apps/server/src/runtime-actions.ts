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
   * Set the current question for a player by index from definition data
   * Expects definition.data.questions to be an array of question objects
   * Params: { index: number, sessionId?: string, questionsPath?: string }
   */
  setQuestionByIndex: (ctx: InterpreterContext, params: any) => {
    const sessionId: string | undefined = params?.sessionId;
    const index: number = Number(params?.index ?? 0);
    const questionsPath: string = params?.questionsPath ?? "questions";

    if (!sessionId) {
      console.warn("[Action] setQuestionByIndex: missing sessionId");
      return;
    }

    const questions = getByPath(ctx.data, questionsPath);
    if (!Array.isArray(questions)) {
      console.warn(
        `[Action] setQuestionByIndex: data.${questionsPath} is not an array`
      );
      return;
    }
    const questionData = questions[index];
    if (!questionData) {
      console.warn(
        `[Action] setQuestionByIndex: question at index ${index} not found`
      );
      return;
    }

    const dynamicClasses = (ctx.room as any).dynamicClasses;
    const QuestionClass = dynamicClasses?.get?.("Question");
    if (!QuestionClass) {
      console.warn("[Action] setQuestionByIndex: Question class not found");
      return;
    }

    const instance = new QuestionClass();
    Object.assign(instance, questionData);

    const base = `players.${sessionId}`;
    setByPath(ctx.state, `${base}.currentQuestion`, instance);
    setByPath(
      ctx.state,
      `${base}.timeLeft`,
      Number(questionData?.timeLeft ?? 30)
    );
    setByPath(ctx.state, `${base}.phase`, "question");
    setByPath(ctx.state, `${base}.showFeedback`, false);
    console.log(
      `[Action] setQuestionByIndex: session=${sessionId} index=${index}`
    );
  },

  /**
   * Advance the player's question index and set the next question
   * If there are no more questions, mark phase as finished
   * Params: { sessionId?: string, questionsPath?: string }
   */
  advanceQuestion: (ctx: InterpreterContext, params: any) => {
    const sessionId: string | undefined = params?.sessionId;
    const questionsPath: string = params?.questionsPath ?? "questions";
    if (!sessionId) {
      console.warn("[Action] advanceQuestion: missing sessionId");
      return;
    }

    const questions = getByPath(ctx.data, questionsPath);
    const base = `players.${sessionId}`;
    const currentIndex: number = Number(
      getByPath(ctx.state, `${base}.questionIndex`) ?? 0
    );
    const nextIndex = currentIndex + 1;

    if (!Array.isArray(questions) || nextIndex >= questions.length) {
      setByPath(ctx.state, `${base}.phase`, "finished");
      setByPath(ctx.state, `${base}.showFeedback`, false);
      console.log(
        `[Action] advanceQuestion: session=${sessionId} finished at index ${currentIndex}`
      );
      return;
    }

    setByPath(ctx.state, `${base}.questionIndex`, nextIndex);

    const dynamicClasses = (ctx.room as any).dynamicClasses;
    const QuestionClass = dynamicClasses?.get?.("Question");
    if (!QuestionClass) {
      console.warn("[Action] advanceQuestion: Question class not found");
      return;
    }

    const instance = new QuestionClass();
    Object.assign(instance, questions[nextIndex]);

    setByPath(ctx.state, `${base}.currentQuestion`, instance);
    setByPath(
      ctx.state,
      `${base}.timeLeft`,
      Number(questions[nextIndex]?.timeLeft ?? 30)
    );
    setByPath(ctx.state, `${base}.phase`, "question");
    setByPath(ctx.state, `${base}.showFeedback`, false);

    console.log(
      `[Action] advanceQuestion: session=${sessionId} -> index=${nextIndex}`
    );
  },

  /**
   * Schedule advancing a player's question after a delay (ms)
   * Params: { sessionId?: string, delayMs?: number, questionsPath?: string }
   */
  scheduleAdvance: (ctx: InterpreterContext, params: any) => {
    const sessionId: string | undefined = params?.sessionId;
    const delayMs: number = Number(params?.delayMs ?? 3000);
    const questionsPath: string = params?.questionsPath ?? "questions";
    if (!sessionId) {
      console.warn("[Action] scheduleAdvance: missing sessionId");
      return;
    }

    setTimeout(() => {
      try {
        // Use our own action to advance
        standardActions.advanceQuestion(ctx, { sessionId, questionsPath });
      } catch (e) {
        console.error("[Action] scheduleAdvance error:", e);
      }
    }, delayMs);

    console.log(
      `[Action] scheduleAdvance: session=${sessionId} in ${delayMs}ms`
    );
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
