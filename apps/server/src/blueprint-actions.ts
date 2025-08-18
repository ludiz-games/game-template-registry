import type {
  ActionImplementations,
  InterpreterContext,
} from "./xstate-interpreter.js";

/**
 * Standard action implementations that blueprints can use.
 * These are safe, whitelisted operations that can be referenced by name in state machines.
 */
export const standardActions: ActionImplementations = {
  /**
   * Set a field on the replicated state
   * Usage: { "type": "setState", "params": { "path": "phase", "value": "question" } }
   */
  setState: (ctx: InterpreterContext, params: any) => {
    const { path, value } = params || {};
    if (path && value !== undefined) {
      setNestedValue(ctx.state, path, value);
      console.log(`[Action] setState: ${path} = ${value}`);
    }
  },

  /**
   * Increment a numeric field
   * Usage: { "type": "increment", "params": { "path": "stepIndex", "delta": 1 } }
   */
  increment: (ctx: InterpreterContext, params: any) => {
    const { path, delta = 1 } = params || {};
    if (path) {
      const current = getNestedValue(ctx.state, path) || 0;
      setNestedValue(ctx.state, path, current + delta);
      console.log(
        `[Action] increment: ${path} by ${delta} = ${current + delta}`
      );
    }
  },

  /**
   * Load current step data into the replicated state
   * Usage: { "type": "loadCurrentStep" }
   */
  loadCurrentStep: (ctx: InterpreterContext) => {
    const stepIndex = ctx.state.stepIndex || 0;
    const steps = ctx.data.steps || [];
    const step = steps[stepIndex];

    if (!step) {
      console.log("[Action] loadCurrentStep: No step found");
      return;
    }

    console.log(
      `[Action] loadCurrentStep: Loading step ${stepIndex} (${step.kind})`
    );

    // Create new QuestionView - assuming we have the class available
    if ((ctx.room as any)._dynamicClasses?.get) {
      const QuestionViewClass = (ctx.room as any)._dynamicClasses.get(
        "QuestionView"
      );
      if (QuestionViewClass) {
        const questionView = new QuestionViewClass();
        questionView.kind = step.kind;
        questionView.question = step.data.question;

        // Handle choices for MCQ
        if (step.kind === "qcm" && step.data.choices) {
          questionView.choices.clear();
          step.data.choices.forEach((choice: string) =>
            questionView.choices.push(choice)
          );
        } else {
          questionView.choices.clear();
        }

        ctx.state.current = questionView;
      }
    }

    // Reset timer
    const timePerStep = ctx.data.timePerStep || 30;
    ctx.state.timeLeftSec = timePerStep;
  },

  /**
   * Check if quiz is finished and transition accordingly
   * Usage: { "type": "checkQuizEnd" }
   */
  checkQuizEnd: (ctx: InterpreterContext) => {
    const stepIndex = ctx.state.stepIndex || 0;
    const totalSteps = ctx.data.steps?.length || 0;

    if (stepIndex >= totalSteps) {
      console.log("[Action] checkQuizEnd: Quiz finished");
      ctx.state.phase = "finished";
    }
  },

  /**
   * Award points to a player
   * Usage: { "type": "awardPoints", "params": { "sessionId": "abc123", "points": 10 } }
   */
  awardPoints: (ctx: InterpreterContext, params: any) => {
    const { sessionId, points = 10 } = params || {};
    if (sessionId && ctx.state.players) {
      const player = ctx.state.players.get(sessionId);
      if (player) {
        player.score += points;
        console.log(
          `[Action] awardPoints: ${player.name} +${points} = ${player.score}`
        );
      }
    }
  },

  /**
   * Broadcast a message to all clients
   * Usage: { "type": "broadcast", "params": { "event": "quiz.finished", "data": {...} } }
   */
  broadcast: (ctx: InterpreterContext, params: any) => {
    const { event, data } = params || {};
    if (event) {
      ctx.room.broadcast(event, data);
      console.log(`[Action] broadcast: ${event}`, data);
    }
  },

  /**
   * Start the countdown timer
   * Usage: { "type": "startTimer" }
   */
  startTimer: (ctx: InterpreterContext) => {
    console.log("[Action] startTimer: Timer started");
    // Timer logic is handled by the "after" transitions in the state machine
    // This action just logs that the timer concept has started
  },

  /**
   * Log a message (useful for debugging)
   * Usage: { "type": "log", "params": { "message": "Game started!" } }
   */
  log: (ctx: InterpreterContext, params: any) => {
    const { message } = params || {};
    console.log(`[Action] log: ${message}`);
  },
};

/**
 * Helper function to get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

/**
 * Helper function to set nested value on object using dot notation
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split(".");
  const lastKey = keys.pop();
  if (!lastKey) return;

  let current = obj;
  for (const key of keys) {
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }
  current[lastKey] = value;
}
