### Colyseus Integration (MVP)

#### Goals

- Provide a minimal real-time backbone for the Multi‑Quiz blueprint: join, submit answer, advance question, score updates.

#### Server Skeleton

```ts
// apps/colyseus-server/src/rooms/QuizRoom.ts
import { Room, Client } from "colyseus";

type Player = { id: string; name?: string; score: number };
type Question = { title: string; choices: string[]; correctIndex: number };

type State = {
  players: Record<string, Player>;
  questions: Question[];
  index: number; // current question index
  open: boolean; // accepting answers
};

export class QuizRoom extends Room<State> {
  maxClients = 32;

  onCreate(options: { questions: Question[] }) {
    this.setState({
      players: {},
      questions: options.questions || [],
      index: 0,
      open: true,
    });

    this.onMessage("submitAnswer", (client, payload: { index: number }) => {
      const player = this.state.players[client.sessionId];
      if (!player || !this.state.open) return;
      const q = this.state.questions[this.state.index];
      if (!q) return;
      if (payload.index === q.correctIndex) {
        player.score += 1;
        this.broadcast("scoreUpdate", {
          id: client.sessionId,
          score: player.score,
        });
      }
    });

    this.onMessage("nextQuestion", () => {
      if (this.state.index < this.state.questions.length - 1) {
        this.state.index += 1;
        this.state.open = true;
        this.broadcast("questionIndex", { index: this.state.index });
      } else {
        this.state.open = false;
        this.lock();
        this.broadcast("finished", {});
      }
    });
  }

  onJoin(client: Client, options: { name?: string }) {
    this.state.players[client.sessionId] = {
      id: client.sessionId,
      name: options.name,
      score: 0,
    };
    client.send("questionIndex", { index: this.state.index });
  }

  onLeave(client: Client) {
    delete this.state.players[client.sessionId];
  }
}
```

#### Client Wrapper

```ts
// apps/web/lib/colyseus/quizClient.ts
import { Client, Room } from "colyseus.js";

export type QuizEvents = {
  questionIndex: (data: { index: number }) => void;
  scoreUpdate: (data: { id: string; score: number }) => void;
  finished: () => void;
};

export class QuizClient {
  private client: Client;
  private room?: Room;

  constructor(endpoint: string) {
    this.client = new Client(endpoint);
  }

  async join(name?: string) {
    this.room = await this.client.joinOrCreate("quizRoom", { name });
    return this.room;
  }

  on<E extends keyof QuizEvents>(event: E, handler: QuizEvents[E]) {
    this.room?.onMessage(event as string, handler as any);
  }

  submitAnswer(index: number) {
    this.room?.send("submitAnswer", { index });
  }

  nextQuestion() {
    this.room?.send("nextQuestion");
  }
}
```

#### Blueprint Wiring

- The `multi-quiz` blueprint includes `lib/colyseus/quizClient.ts` and uses it inside `app/quiz/page.tsx` to synchronize UI state with the room.

#### Notes

- Host the Colyseus server separately; configure the endpoint via env var.
- Schema/type sharing can be done via a small shared package if we adopt a monorepo.
