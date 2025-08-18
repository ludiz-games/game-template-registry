import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Import from the built server files
import { standardActions } from "../../../../build/blueprint-actions.js";
import { schemaBuilder } from "../../../../build/schema-builder.js";
import { XStateInterpreter } from "../../../../build/xstate-interpreter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Multi-quiz state DSL - defines the replicated state shape
export const dsl = {
  root: "State",
  classes: {
    Player: {
      name: { type: "string" },
      score: { type: "number" },
    },
    QuestionView: {
      kind: { type: "string" },
      question: { type: "string" },
      choices: { array: "string" },
    },
    State: {
      phase: { type: "string" },
      stepIndex: { type: "number" },
      timeLeftSec: { type: "number" },
      players: { map: "Player" },
      current: { ref: "QuestionView" },
    },
  },
  defaults: {
    State: {
      phase: "idle",
      stepIndex: 0,
      timeLeftSec: 30,
    },
    Player: {
      name: "Player",
      score: 0,
    },
    QuestionView: {
      kind: "qcm",
      question: "",
      choices: [],
    },
  },
};

// State machine definition - defines the game logic
export const machine = {
  id: "multi-quiz",
  initial: "idle",
  context: {
    timePerStep: 30,
  },
  states: {
    idle: {
      on: {
        "game.start": {
          target: "question",
          actions: ["loadCurrentStep", "startTimer"],
        },
      },
    },
    question: {
      after: {
        1000: {
          actions: ["tick"], // Execute tick action after 1000ms
        },
      },
      on: {
        "game.start": {
          // Allow restart from question state
          target: "question",
          actions: ["loadCurrentStep", "startTimer"],
        },
        "answer.submit": {
          actions: ["checkAnswer", "advanceStep"],
        },
        "time.up": {
          actions: ["advanceStep"],
        },
      },
    },
    finished: {
      type: "final",
      entry: ["broadcast"],
      on: {
        "game.start": {
          // Allow restart from finished state
          target: "question",
          actions: ["resetGame", "loadCurrentStep", "startTimer"],
        },
      },
    },
  },
};

// Load static data (quiz questions)
let quizData = null;
try {
  const questionsPath = join(__dirname, "questions.json");
  quizData = JSON.parse(readFileSync(questionsPath, "utf8"));
} catch (error) {
  console.error("Failed to load questions.json:", error);
}

export async function register(room, ctx) {
  console.log(`[multi-quiz] Registering room for project ${ctx.projectId}`);

  // Build runtime schema from DSL
  const { StateClass, classes, instantiateWithDefaults } =
    schemaBuilder.build(dsl);

  // Make classes available to GenericRoom for player creation
  // Store classes on the room directly instead of bundle
  room._dynamicClasses = classes;

  // Set the dynamically generated state
  const state = instantiateWithDefaults();
  room.setState(state);

  // Get quiz config from options or fallback to local file
  const config = await ctx.getConfig();
  const quiz = config?.quiz || quizData;

  if (!quiz || !quiz.steps) {
    throw new Error("No quiz data provided in config or questions.json");
  }

  console.log(`[multi-quiz] Loaded quiz with ${quiz.steps.length} steps`);

  // Create interpreter context
  const interpreterContext = {
    room,
    state,
    context: { ...machine.context, ...quiz },
    data: quiz, // Static quiz data
    clock: room.clock,
  };

  // Define custom actions for this blueprint
  const customActions = {
    ...standardActions,

    // Custom action: Check if answer is correct and award points
    checkAnswer: (ctx, eventData) => {
      const { event } = eventData || {};
      const sessionId = event?.sessionId; // We'll need to pass this
      const stepIndex = ctx.state.stepIndex || 0;
      const steps = ctx.data.steps || [];
      const step = steps[stepIndex];

      if (!step || !sessionId) return;

      let correct = false;

      if (step.kind === "qcm" && typeof event.choiceIndex === "number") {
        correct = event.choiceIndex === step.data.correctIndex;
        console.log(
          `[Action] checkAnswer MCQ: ${event.choiceIndex} vs ${step.data.correctIndex} = ${correct}`
        );
      } else if (step.kind === "tf" && typeof event.value === "boolean") {
        correct = event.value === step.data.correctValue;
        console.log(
          `[Action] checkAnswer TF: ${event.value} vs ${step.data.correctValue} = ${correct}`
        );
      }

      if (correct) {
        standardActions.awardPoints(ctx, { sessionId, points: 10 });
      }
    },

    // Custom action: Reset game to beginning
    resetGame: (ctx) => {
      console.log("[Action] resetGame: Resetting quiz to beginning");
      ctx.state.stepIndex = 0;
      ctx.state.phase = "question";

      // Reset all player scores
      if (ctx.state.players) {
        for (const [sessionId, player] of ctx.state.players.entries()) {
          player.score = 0;
        }
      }
    },

    // Custom action: Advance to next step or finish quiz
    advanceStep: (ctx) => {
      const currentIndex = ctx.state.stepIndex || 0;
      const nextIndex = currentIndex + 1;
      const totalSteps = ctx.data.steps?.length || 0;

      if (nextIndex >= totalSteps) {
        console.log("[Action] advanceStep: Quiz finished");
        ctx.state.phase = "finished";
        return;
      }

      console.log(`[Action] advanceStep: ${currentIndex} -> ${nextIndex}`);
      ctx.state.stepIndex = nextIndex;
      standardActions.loadCurrentStep(ctx);
    },

    // Custom action: Timer tick (called every second)
    tick: (ctx) => {
      if (ctx.state.phase !== "question") return;

      const timeLeft = Math.max(0, (ctx.state.timeLeftSec || 0) - 1);
      ctx.state.timeLeftSec = timeLeft;

      if (timeLeft <= 0) {
        console.log("[Action] tick: Time up, advancing step!");
        // Directly call advanceStep instead of sending event to avoid recursion
        customActions.advanceStep(ctx);
      }
    },

    // Custom action: Decrement timer and check for timeout
    decrementTimer: (ctx) => {
      const timeLeft = Math.max(0, (ctx.state.timeLeftSec || 0) - 1);
      ctx.state.timeLeftSec = timeLeft;

      if (timeLeft <= 0) {
        console.log("[Action] decrementTimer: Time up!");
        // Send internal event to advance step
        interpreter.send("time.up");
      }
    },
  };

  // Create XState interpreter (much more reliable than custom implementation)
  const interpreter = new XStateInterpreter(
    machine,
    customActions,
    interpreterContext
  );

  // Wire up message handlers to send events to the state machine
  room.onMessage("game.start", (client, message) => {
    console.log(`[multi-quiz] Game start from ${client.sessionId}`);
    interpreter.send("game.start");
  });

  room.onMessage("answer.submit", (client, message) => {
    console.log(`[multi-quiz] Answer from ${client.sessionId}:`, message);

    // Validate message
    if (typeof message !== "object" || message === null) {
      console.log("[multi-quiz] Invalid message format");
      return;
    }

    // Add sessionId to the event data so actions can use it
    interpreter.send("answer.submit", {
      ...message,
      sessionId: client.sessionId,
    });
  });

  // Cleanup on room disposal
  room.onDispose = () => {
    console.log("[multi-quiz] Room disposing, cleaning up interpreter");
    interpreter.dispose();
  };
}

export const metadata = {
  kind: "quiz",
  version: "0.2.0",
  blueprint: "multi-quiz",
  description: "Generic state machine driven multi-quiz",
};
