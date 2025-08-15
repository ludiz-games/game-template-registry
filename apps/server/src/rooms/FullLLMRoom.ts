import { Client, Room } from "@colyseus/core";
import {
  BasePlayer,
  BaseState,
  type RoomOptions,
  type StepNode,
  type UIEvent,
} from "@repo/colyseus-types";

export class FullLLMRoom extends Room<BaseState> {
  maxClients = 16;
  private steps: StepNode[] = [];
  private tickHandle: any;

  onCreate() {
    this.setState(new BaseState());

    this.onMessage("ui.event", (client, message: UIEvent) => {
      console.log(
        "Server received message:",
        message,
        "from client:",
        client.sessionId
      );
      const player = this.state.players.get(client.sessionId);
      if (!player) {
        console.log("Player not found for session:", client.sessionId);
        return;
      }

      const type = message?.type;
      console.log("Processing message type:", type);
      if (type === "answer.submit") {
        const stepIdx = this.state.extNum.get("stepIndex") ?? 0;
        const current = this.steps[stepIdx];
        console.log("Current step index:", stepIdx, "Current step:", current);
        let correct = false;
        if (current?.kind === "qcm") {
          const idx = Number(message?.choiceIndex);
          const answerIndex = Number(current?.data?.correctIndex);
          console.log(
            "MCQ: submitted index:",
            idx,
            "correct index:",
            answerIndex
          );
          correct = Number.isInteger(idx) && idx === answerIndex;
        } else if (current?.kind === "tf") {
          const expected = Boolean(current?.data?.correctValue);
          const submitted =
            (message as any)?.correct ?? (message as any)?.value;
          console.log("TF: submitted:", submitted, "expected:", expected);
          correct = Boolean(submitted) === expected;
        }
        console.log("Answer is correct:", correct);
        if (correct) {
          player.score += 10;
          console.log("Player score updated to:", player.score);
        }
        console.log("Calling nextStep()");
        this.nextStep();
      } else if (
        type === "navigate.to" &&
        typeof message?.outlineId === "string"
      ) {
        this.state.outline.currentId = message.outlineId;
      } else if (type === "game.start") {
        // Manual start game trigger
        if (this.state.phase === "idle") {
          this.startQuiz();
        }
      }
    });
  }

  onJoin(client: Client, options: RoomOptions) {
    const player = new BasePlayer();
    player.name = options?.name || "Player";
    this.state.players.set(client.sessionId, player);

    // start quiz on first join (or if room was idle)
    if (this.state.phase === "idle") {
      this.startQuiz();
      client.send("definition", { steps: this.steps });
    } else {
      if (this.steps.length > 0) {
        client.send("definition", { steps: this.steps });
      }
    }
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    if (this.tickHandle) {
      const h: any = this.tickHandle as any;
      if (typeof h.clear === "function") h.clear();
      else if ((this as any).clock?.clear)
        (this as any).clock.clear(this.tickHandle);
      this.tickHandle = undefined as any;
    }
  }

  private startQuiz() {
    this.steps = this.buildSteps();
    this.state.extNum.set("totalSteps", this.steps.length);
    this.state.phase = "question";
    this.loadStep(0);
    this.tickHandle = this.clock.setInterval(() => this.onTick(), 1000);
  }

  private buildSteps(): StepNode[] {
    return [
      {
        kind: "qcm",
        data: {
          question: "What is the average length of a Martian day (a 'sol')?",
          choices: ["23 h 56 m", "24 h 37 m", "26 h 10 m", "20 h 00 m"],
          correctIndex: 1,
        },
      },
      {
        kind: "tf",
        data: {
          question: "Water ice exists at the Martian poles.",
          correctValue: true,
        },
      },
      {
        kind: "qcm",
        data: {
          question: "Which rover landed on Mars in 2021?",
          choices: ["Curiosity", "Opportunity", "Perseverance", "Spirit"],
          correctIndex: 2,
        },
      },
      {
        kind: "tf",
        data: {
          question: "Mars' gravity is stronger than Earth's.",
          correctValue: false,
        },
      },
      {
        kind: "qcm",
        data: {
          question: "Main component of Mars' atmosphere?",
          choices: ["Oxygen", "Nitrogen", "Carbon dioxide", "Methane"],
          correctIndex: 2,
        },
      },
      {
        kind: "tf",
        data: {
          question: "Ingenuity is a fixed‑wing aircraft.",
          correctValue: false,
        },
      },
      {
        kind: "qcm",
        data: {
          question: "Typical one‑way radio delay Earth↔Mars can vary between…",
          choices: [
            "0–30 seconds",
            "1–2 minutes",
            "3–22 minutes",
            "60–90 minutes",
          ],
          correctIndex: 2,
        },
      },
      {
        kind: "tf",
        data: {
          question: "Olympus Mons is the tallest volcano in the Solar System.",
          correctValue: true,
        },
      },
      {
        kind: "qcm",
        data: {
          question: "How many moons does Mars have?",
          choices: ["1", "2", "3", "4"],
          correctIndex: 1,
        },
      },
      {
        kind: "tf",
        data: {
          question: "Solar panels produce more power on Mars than on Earth.",
          correctValue: false,
        },
      },
    ];
  }

  private loadStep(index: number) {
    this.state.extNum.set("stepIndex", index);
    const s = this.steps[index];
    if (!s) return;
    // Only counters live in state; definition stays out-of-state.
    if (s.kind === "qcm") {
      const choices: string[] = Array.isArray(s.data?.choices)
        ? s.data.choices
        : [];
      this.state.extNum.set("choicesCount", choices.length);
    } else {
      this.state.extNum.set("choicesCount", 0);
    }
    this.state.extNum.set("timeLeftSec", 30);
  }

  private nextStep() {
    const current = this.state.extNum.get("stepIndex") ?? 0;
    const next = current + 1;
    console.log(
      "nextStep: current =",
      current,
      "next =",
      next,
      "totalSteps =",
      this.state.extNum.get("totalSteps")
    );
    if (next >= (this.state.extNum.get("totalSteps") ?? this.steps.length)) {
      console.log("Game finished, setting phase to 'finished'");
      this.state.phase = "finished";
      this.state.outline.currentId = "results";
      if (this.tickHandle) {
        const h: any = this.tickHandle as any;
        if (typeof h.clear === "function") h.clear();
        else if ((this as any).clock?.clear)
          (this as any).clock.clear(this.tickHandle);
        this.tickHandle = undefined as any;
      }
      return;
    }
    console.log("Loading next step:", next);
    this.loadStep(next);
  }

  private onTick() {
    if (this.state.phase !== "question") return;
    const left = (this.state.extNum.get("timeLeftSec") ?? 0) - 1;
    if (left >= 0) {
      this.state.extNum.set("timeLeftSec", left);
      if (left <= 0) this.nextStep();
    }
  }
}
