import { beforeEach, describe, expect, it } from "vitest";
import { standardActions } from "../runtime-actions.js";
import { XStateInterpreter } from "../xstate-interpreter.js";

// Enhanced quiz state machine definition (same as in client)
const ENHANCED_QUIZ_MACHINE = {
  id: "enhanced-quiz",
  initial: "waiting",
  context: {},
  states: {
    waiting: {
      on: {
        start: {
          target: "question1",
          actions: [
            { type: "setState", path: "phase", value: "question" },
            { type: "setState", path: "questionIndex", value: 0 },
            { type: "log", message: "Quiz started!" },
          ],
        },
      },
    },
    question1: {
      entry: [
        { type: "setState", path: "timeLeft", value: 30 },
        {
          type: "createInstance",
          className: "Question",
          statePath: "currentQuestion",
          data: {},
        },
        { type: "setState", path: "currentQuestion.id", value: "q1" },
        { type: "setState", path: "currentQuestion.type", value: "mcq" },
        {
          type: "setState",
          path: "currentQuestion.text",
          value: "What is the capital of France?",
        },
        {
          type: "setState",
          path: "currentQuestion.choices",
          value: ["London", "Berlin", "Paris", "Madrid"],
        },
        { type: "setState", path: "currentQuestion.correctAnswer", value: "2" },
      ],
      on: {
        answer: {
          target: "feedback1",
          actions: [
            { type: "setState", path: "phase", value: "feedback" },
            { type: "setState", path: "showFeedback", value: true },
            { type: "log", message: "Answer submitted!" },
          ],
        },
      },
    },
    feedback1: {
      after: {
        3000: {
          target: "question2",
          actions: [
            { type: "setState", path: "phase", value: "question" },
            { type: "setState", path: "showFeedback", value: false },
            { type: "increment", path: "questionIndex", delta: 1 },
          ],
        },
      },
    },
    question2: {
      entry: [
        { type: "setState", path: "timeLeft", value: 30 },
        {
          type: "createInstance",
          className: "Question",
          statePath: "currentQuestion",
          data: {},
        },
        { type: "setState", path: "currentQuestion.id", value: "q2" },
        { type: "setState", path: "currentQuestion.type", value: "tf" },
        {
          type: "setState",
          path: "currentQuestion.text",
          value: "The Earth is flat.",
        },
        {
          type: "setState",
          path: "currentQuestion.correctAnswer",
          value: "false",
        },
      ],
      on: {
        answer: {
          target: "feedback2",
          actions: [
            { type: "setState", path: "phase", value: "feedback" },
            { type: "setState", path: "showFeedback", value: true },
            { type: "log", message: "Answer submitted!" },
          ],
        },
      },
    },
    feedback2: {
      after: {
        3000: {
          target: "finished",
          actions: [
            { type: "setState", path: "phase", value: "finished" },
            { type: "log", message: "Quiz completed!" },
          ],
        },
      },
    },
    finished: {
      on: {
        restart: {
          target: "waiting",
          actions: [
            { type: "setState", path: "phase", value: "waiting" },
            { type: "setState", path: "questionIndex", value: 0 },
            { type: "setState", path: "showFeedback", value: false },
          ],
        },
      },
    },
  },
};

describe("Enhanced Quiz State Machine", () => {
  let interpreter: XStateInterpreter;
  let mockState: any;
  let mockRoom: any;
  let actionLogs: string[];

  beforeEach(() => {
    // Reset state and logs
    actionLogs = [];
    mockState = {
      phase: "waiting",
      questionIndex: 0,
      timeLeft: 30,
      showFeedback: false,
      currentQuestion: null,
      players: new Map(),
    };

    mockRoom = {
      dynamicClasses: new Map([
        [
          "Question",
          class Question {
            id = "";
            type = "";
            text = "";
            choices: string[] = [];
            correctAnswer = "";
          },
        ],
      ]),
      broadcast: (event: string, data?: any) => {
        actionLogs.push(`broadcast:${event}`);
      },
    };

    // Create test actions that log their execution
    const testActions = {
      ...standardActions,
      log: (ctx: any, params: any) => {
        actionLogs.push(`log:${params.message}`);
      },
    };

    const context = {
      room: mockRoom,
      state: mockState,
      context: {},
      data: {},
      clock: { deltaTime: 16 },
    };

    interpreter = new XStateInterpreter(
      ENHANCED_QUIZ_MACHINE,
      testActions,
      context
    );
  });

  describe("Initial State", () => {
    it("should start in waiting state", () => {
      expect(interpreter.getCurrentState()).toBe("waiting");
    });

    it("should have correct initial state values", () => {
      expect(mockState.phase).toBe("waiting");
      expect(mockState.questionIndex).toBe(0);
      expect(mockState.showFeedback).toBe(false);
    });
  });

  describe("Game Start Flow", () => {
    it("should transition from waiting to question1 on start event", () => {
      interpreter.send("start");
      expect(interpreter.getCurrentState()).toBe("question1");
    });

    it("should execute start actions correctly", () => {
      interpreter.send("start");

      expect(mockState.phase).toBe("question");
      expect(mockState.questionIndex).toBe(0);
      expect(actionLogs).toContain("log:Quiz started!");
    });

    it("should create first question on entering question1", () => {
      interpreter.send("start");

      // Check that currentQuestion was created and populated
      expect(mockState.currentQuestion).toBeTruthy();
      expect(mockState.currentQuestion.id).toBe("q1");
      expect(mockState.currentQuestion.type).toBe("mcq");
      expect(mockState.currentQuestion.text).toBe(
        "What is the capital of France?"
      );
      expect(mockState.currentQuestion.choices).toEqual([
        "London",
        "Berlin",
        "Paris",
        "Madrid",
      ]);
      expect(mockState.currentQuestion.correctAnswer).toBe("2");
      expect(mockState.timeLeft).toBe(30);
    });
  });

  describe("Answer Submission Flow", () => {
    beforeEach(() => {
      // Start the quiz to get to question1
      interpreter.send("start");
      actionLogs.length = 0; // Clear logs
    });

    it("should transition from question1 to feedback1 on answer event", () => {
      expect(interpreter.getCurrentState()).toBe("question1");

      interpreter.send("answer", { value: "2", type: "mcq" });

      expect(interpreter.getCurrentState()).toBe("feedback1");
    });

    it("should execute answer submission actions", () => {
      interpreter.send("answer", { value: "2", type: "mcq" });

      expect(mockState.phase).toBe("feedback");
      expect(mockState.showFeedback).toBe(true);
      expect(actionLogs).toContain("log:Answer submitted!");
    });

    it("should handle wrong answers the same way", () => {
      interpreter.send("answer", { value: "0", type: "mcq" });

      expect(interpreter.getCurrentState()).toBe("feedback1");
      expect(mockState.phase).toBe("feedback");
      expect(mockState.showFeedback).toBe(true);
    });
  });

  describe("Question Progression", () => {
    beforeEach(() => {
      // Start quiz and answer first question
      interpreter.send("start");
      interpreter.send("answer", { value: "2", type: "mcq" });
      actionLogs.length = 0; // Clear logs
    });

    it("should auto-advance from feedback1 to question2 after timeout", (done) => {
      expect(interpreter.getCurrentState()).toBe("feedback1");

      // Fast-forward time to trigger the after transition
      setTimeout(() => {
        expect(interpreter.getCurrentState()).toBe("question2");
        expect(mockState.phase).toBe("question");
        expect(mockState.showFeedback).toBe(false);
        expect(mockState.questionIndex).toBe(1);
        done();
      }, 3100); // Slightly more than 3000ms timeout
    }, 5000);

    it("should create second question (True/False) on entering question2", (done) => {
      setTimeout(() => {
        expect(mockState.currentQuestion.id).toBe("q2");
        expect(mockState.currentQuestion.type).toBe("tf");
        expect(mockState.currentQuestion.text).toBe("The Earth is flat.");
        expect(mockState.currentQuestion.correctAnswer).toBe("false");
        done();
      }, 3100);
    }, 5000);
  });

  describe("Quiz Completion Flow", () => {
    it("should complete the full quiz flow", (done) => {
      // Start quiz
      interpreter.send("start");
      expect(interpreter.getCurrentState()).toBe("question1");

      // Answer first question
      interpreter.send("answer", { value: "2", type: "mcq" });
      expect(interpreter.getCurrentState()).toBe("feedback1");

      // Wait for auto-advance to question2
      setTimeout(() => {
        expect(interpreter.getCurrentState()).toBe("question2");

        // Answer second question
        interpreter.send("answer", { value: "false", type: "tf" });
        expect(interpreter.getCurrentState()).toBe("feedback2");

        // Wait for completion
        setTimeout(() => {
          expect(interpreter.getCurrentState()).toBe("finished");
          expect(mockState.phase).toBe("finished");
          expect(actionLogs).toContain("log:Quiz completed!");
          done();
        }, 3100);
      }, 3100);
    }, 10000);
  });

  describe("Restart Flow", () => {
    it("should restart from finished state", (done) => {
      // Complete the quiz first
      interpreter.send("start");
      interpreter.send("answer", { value: "2", type: "mcq" });

      setTimeout(() => {
        interpreter.send("answer", { value: "false", type: "tf" });

        setTimeout(() => {
          expect(interpreter.getCurrentState()).toBe("finished");

          // Now restart
          interpreter.send("restart");
          expect(interpreter.getCurrentState()).toBe("waiting");
          expect(mockState.phase).toBe("waiting");
          expect(mockState.questionIndex).toBe(0);
          expect(mockState.showFeedback).toBe(false);
          done();
        }, 3100);
      }, 3100);
    }, 10000);
  });

  describe("Event Validation", () => {
    it("should ignore invalid events in waiting state", () => {
      expect(interpreter.getCurrentState()).toBe("waiting");

      interpreter.send("answer", { value: "2" });
      expect(interpreter.getCurrentState()).toBe("waiting"); // Should stay in waiting
    });

    it("should ignore invalid events in question state", () => {
      interpreter.send("start");
      expect(interpreter.getCurrentState()).toBe("question1");

      interpreter.send("restart");
      expect(interpreter.getCurrentState()).toBe("question1"); // Should stay in question1
    });
  });

  describe("State Persistence", () => {
    it("should maintain state values across transitions", () => {
      interpreter.send("start");

      const initialQuestionIndex = mockState.questionIndex;
      const initialQuestion = { ...mockState.currentQuestion };

      interpreter.send("answer", { value: "2", type: "mcq" });

      // Values should persist through feedback state
      expect(mockState.questionIndex).toBe(initialQuestionIndex);
      expect(mockState.currentQuestion.id).toBe(initialQuestion.id);
    });
  });
});
