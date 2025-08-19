"use client";

import { colyseus } from "@ludiz/colyseus-hooks";
import { Clock, LogOut, Play, RotateCcw, Trophy, Users } from "lucide-react";
import React, { useState } from "react";
import { MCQComponent } from "./mcq-component";
import { TrueFalseComponent } from "./true-false-component";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Progress } from "./ui/progress";
import { Separator } from "./ui/separator";

interface Player {
  name: string;
  score: number;
  phase?: string;
  currentQuestion?: Question;
  questionIndex?: number;
  timeLeft?: number;
  showFeedback?: boolean;
}

interface Question {
  id: string;
  type: "mcq" | "tf" | "text";
  text: string;
  choices?: string[];
  correctAnswer?: string | boolean;
}

interface DemoState {
  // Global fields may exist but UI will use per-player fields instead
  phase?: string;
  currentQuestion?: Question;
  questionIndex?: number;
  timeLeft?: number;
  showFeedback?: boolean;
  players?: Map<string, Player>;
}

// Enhanced demo definition with multiple question types
const DEMO_DEFINITION = {
  id: "enhanced-quiz",
  name: "Quiz Demo",
  version: "1.0.0",
  schema: {
    root: "State",
    classes: {
      Player: {
        name: { type: "string" },
        score: { type: "number" },
        // Per-player fields for independent progress
        phase: { type: "string" },
        currentQuestion: { ref: "Question" },
        questionIndex: { type: "number" },
        timeLeft: { type: "number" },
        showFeedback: { type: "boolean" },
      },
      Question: {
        id: { type: "string" },
        type: { type: "string" },
        text: { type: "string" },
        choices: { array: "string" },
        correctAnswer: { type: "string" },
      },
      State: {
        players: { map: "Player" },
      },
    },
    defaults: {
      State: {
        // Global defaults remain unused for per-player flow
      },
      Player: {
        name: "Player",
        score: 0,
        phase: "waiting",
        questionIndex: 0,
        timeLeft: 30,
        showFeedback: false,
        currentQuestion: null,
      },
      Question: {
        id: "",
        type: "mcq",
        text: "",
        choices: [],
        correctAnswer: "",
      },
    },
  },
  machine: {
    id: "enhanced-quiz",
    initial: "waiting",
    context: {},
    states: {
      waiting: {
        on: {
          start: {
            actions: [
              {
                type: "setState",
                path: "players.${event.sessionId}.questionIndex",
                value: 0,
              },
              {
                type: "createInstanceFromArray",
                className: "Question",
                statePath: "players.${event.sessionId}.currentQuestion",
                arrayPath: "questions",
                index: 0,
              },
              {
                type: "setFromArray",
                statePath: "players.${event.sessionId}.timeLeft",
                arrayPath: "questions",
                key: "timeLeft",
                index: 0,
              },
              {
                type: "setState",
                path: "players.${event.sessionId}.phase",
                value: "question",
              },
              {
                type: "setState",
                path: "players.${event.sessionId}.showFeedback",
                value: false,
              },
              { type: "log", message: "Quiz started for ${event.sessionId}!" },
            ],
          },
          answer: {
            actions: [
              {
                type: "setState",
                path: "players.${event.sessionId}.phase",
                value: "feedback",
              },
              {
                type: "setState",
                path: "players.${event.sessionId}.showFeedback",
                value: true,
              },
              {
                type: "incrementIfEqual",
                path: "players.${event.sessionId}.score",
                equalsPath:
                  "players.${event.sessionId}.currentQuestion.correctAnswer",
                value: "${event.value}",
                delta: 1,
              },
              {
                type: "scheduleActions",
                delayMs: 3000,
                actions: [
                  {
                    type: "increment",
                    path: "players.${event.sessionId}.questionIndex",
                    delta: 1,
                  },
                  {
                    type: "when",
                    cond: {
                      "<": [
                        {
                          var: "state.players.${event.sessionId}.questionIndex",
                        },
                        { var: "data.questionsCount" },
                      ],
                    },
                    then: [
                      {
                        type: "createInstanceFromArray",
                        className: "Question",
                        statePath: "players.${event.sessionId}.currentQuestion",
                        arrayPath: "questions",
                        indexStatePath:
                          "players.${event.sessionId}.questionIndex",
                      },
                      {
                        type: "setFromArray",
                        statePath: "players.${event.sessionId}.timeLeft",
                        arrayPath: "questions",
                        key: "timeLeft",
                        indexStatePath:
                          "players.${event.sessionId}.questionIndex",
                      },
                      {
                        type: "setState",
                        path: "players.${event.sessionId}.phase",
                        value: "question",
                      },
                      {
                        type: "setState",
                        path: "players.${event.sessionId}.showFeedback",
                        value: false,
                      },
                    ],
                    else: [
                      {
                        type: "setState",
                        path: "players.${event.sessionId}.phase",
                        value: "finished",
                      },
                      {
                        type: "setState",
                        path: "players.${event.sessionId}.showFeedback",
                        value: false,
                      },
                    ],
                  },
                ],
              },
              {
                type: "log",
                message: "Answer submitted by ${event.sessionId}",
              },
            ],
          },
          restart: {
            actions: [
              {
                type: "setState",
                path: "players.${event.sessionId}.phase",
                value: "waiting",
              },
              {
                type: "setState",
                path: "players.${event.sessionId}.questionIndex",
                value: 0,
              },
              {
                type: "setState",
                path: "players.${event.sessionId}.showFeedback",
                value: false,
              },
              {
                type: "setState",
                path: "players.${event.sessionId}.score",
                value: 0,
              },
            ],
          },
        },
      },
    },
  },
  data: {
    questions: [
      {
        id: "q1",
        type: "mcq",
        text: "What is the capital of France?",
        choices: ["London", "Berlin", "Paris", "Madrid"],
        correctAnswer: "2",
        timeLeft: 30,
      },
      {
        id: "q2",
        type: "tf",
        text: "The Earth is flat.",
        correctAnswer: "false",
        timeLeft: 30,
      },
      {
        id: "q3",
        type: "mcq",
        text: "Which programming language is this demo written in?",
        choices: ["Python", "JavaScript", "Java", "C++"],
        correctAnswer: "1",
        timeLeft: 30,
      },
      {
        id: "q4",
        type: "tf",
        text: "React is a JavaScript library for building user interfaces.",
        correctAnswer: "true",
        timeLeft: 30,
      },
    ],
    questionsCount: 4,
  },
};

// Initialize colyseus hooks
const {
  connectToColyseus,
  disconnectFromColyseus,
  useColyseusRoom,
  useColyseusState,
} = colyseus<DemoState>("ws://localhost:2567");

export function SimpleDemo() {
  const [playerName, setPlayerName] = useState("Player");
  const [selectedAnswer, setSelectedAnswer] = useState<string | boolean | null>(
    null
  );

  const room = useColyseusRoom();
  const state = useColyseusState() as DemoState | undefined;
  const me = React.useMemo(() => {
    if (!room || !state?.players) return undefined as Player | undefined;
    try {
      // Map access by sessionId
      return (state.players as any).get(room.sessionId) as Player | undefined;
    } catch {
      return undefined;
    }
  }, [room, state]);

  // Debug: log state changes and reset selectedAnswer when question changes
  React.useEffect(() => {
    if (state) {
      console.log("🔍 Current state:", {
        phase: state.phase,
        questionIndex: state.questionIndex,
        currentQuestion: state.currentQuestion,
        timeLeft: state.timeLeft,
        showFeedback: state.showFeedback,
      });

      // Debug currentQuestion object specifically
      if (me?.currentQuestion) {
        console.log("🔍 Question details:", {
          id: me.currentQuestion.id,
          type: me.currentQuestion.type,
          text: me.currentQuestion.text,
          choices: me.currentQuestion.choices,
          correctAnswer: me.currentQuestion.correctAnswer,
          keys: Object.keys(me.currentQuestion as any),
          proto: Object.getPrototypeOf(me.currentQuestion as any)?.constructor
            ?.name,
        });
      }

      // Reset selected answer when moving to a new question for this player
      if (me?.phase === "question" && !me?.showFeedback) {
        setSelectedAnswer(null);
      }
    }
  }, [state, me?.currentQuestion, me?.phase, me?.showFeedback]);

  const connect = async () => {
    try {
      console.log("🚀 Connecting with definition:", DEMO_DEFINITION);

      await connectToColyseus("project", {
        projectId: "demo",
        definitionId: "enhanced-quiz",
        name: playerName,
        definition: DEMO_DEFINITION, // Pass definition as JSON
      });

      console.log("✅ Connected to room");
    } catch (error) {
      console.error("❌ Connection failed:", error);
    }
  };

  const startGame = () => {
    console.log("🎮 Starting game");
    room?.send("start");
    setSelectedAnswer(null);
  };

  const handleMCQAnswer = (choiceId: string) => {
    console.log("📝 MCQ answer selected:", choiceId);
    setSelectedAnswer(choiceId);
    room?.send("answer", { value: choiceId, type: "mcq" });
  };

  const handleTrueFalseAnswer = (value: boolean) => {
    console.log("📝 True/False answer selected:", value);
    setSelectedAnswer(value);
    room?.send("answer", { value: value.toString(), type: "tf" });
  };

  const restartGame = () => {
    console.log("🔄 Restarting game");
    room?.send("restart");
    setSelectedAnswer(null);
  };

  const disconnect = async () => {
    await disconnectFromColyseus();
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-lg mx-auto p-6 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Quiz Demo</h1>
            <p className="text-muted-foreground">
              Test MCQ and True/False questions with real-time scoring!
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Join Quiz Room</CardTitle>
              <CardDescription>
                Enter your name to connect and start playing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="playerName">Your Name</Label>
                <Input
                  id="playerName"
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name..."
                />
              </div>

              <Button onClick={connect} className="w-full" size="lg">
                Connect to Quiz Room
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quiz Demo</h1>
            <p className="text-muted-foreground">Real-time multiplayer quiz</p>
          </div>
          <Button onClick={disconnect} variant="outline">
            <LogOut className="w-4 h-4" />
            Disconnect
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Quiz Status
              <Badge variant="secondary" className="capitalize">
                {me?.phase ?? "waiting"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Players Connected
                </p>
                <p className="text-2xl font-bold">
                  {state?.players ? state.players.size : 0}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Question Progress
                </p>
                <p className="text-2xl font-bold">
                  {(me?.questionIndex || 0) + 1} / 4
                </p>
              </div>
            </div>

            {me?.timeLeft && me.phase === "question" && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Time Remaining
                  </span>
                  <span className="font-semibold">{me?.timeLeft ?? 0}s</span>
                </div>
                <Progress
                  value={((me?.timeLeft ?? 0) / 30) * 100}
                  className="h-2"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Player Scores */}
        {state?.players && state.players.size > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(Array.from(state.players.entries()) as any).map(
                  ([sessionId, player]: [any, any]) => (
                    <div
                      key={sessionId}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <span className="font-medium">{player.name}</span>
                      <Badge variant="outline" className="font-semibold">
                        {player.score} pts
                      </Badge>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {(me?.phase ?? "waiting") === "waiting" && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Ready to Start?</h3>
                  <p className="text-muted-foreground">
                    Click the button below to begin your quiz
                  </p>
                </div>
                <Button onClick={startGame} size="lg" className="w-full">
                  <Play className="w-5 h-5" />
                  Start Enhanced Quiz
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {me &&
          (me.phase === "question" || me.phase === "feedback") &&
          me.currentQuestion &&
          me.currentQuestion.text && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Question {(me.questionIndex || 0) + 1}
                    <Badge variant="outline">
                      {me.currentQuestion.type.toUpperCase()}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-lg leading-relaxed">
                    {me.currentQuestion.text}
                  </p>

                  {me.currentQuestion.type === "mcq" &&
                    me.currentQuestion.choices && (
                      <MCQComponent
                        choices={Array.from(me.currentQuestion.choices).map(
                          (text, index) => ({
                            id: index.toString(),
                            text,
                            isCorrect:
                              index.toString() ===
                              me.currentQuestion?.correctAnswer,
                          })
                        )}
                        selectedChoice={
                          typeof selectedAnswer === "string"
                            ? selectedAnswer
                            : null
                        }
                        onChoiceSelect={handleMCQAnswer}
                        showFeedback={me.showFeedback}
                        disabled={me.phase === "feedback"}
                      />
                    )}

                  {me.currentQuestion.type === "tf" && (
                    <TrueFalseComponent
                      correctAnswer={
                        me.currentQuestion.correctAnswer === "true"
                      }
                      selectedAnswer={
                        typeof selectedAnswer === "boolean"
                          ? selectedAnswer
                          : null
                      }
                      onAnswerSelect={handleTrueFalseAnswer}
                      showFeedback={me.showFeedback}
                      disabled={me.phase === "feedback"}
                    />
                  )}
                </CardContent>
              </Card>

              {me.phase === "feedback" && me.showFeedback && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center space-y-2">
                      <Badge variant="secondary">Feedback</Badge>
                      <p className="text-muted-foreground">
                        Next question in a few seconds...
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

        {me?.phase === "finished" && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-6">
                <div className="space-y-2">
                  <Badge variant="default" className="text-base px-4 py-2">
                    🎉 Quiz Complete!
                  </Badge>
                  <h2 className="text-2xl font-bold">Great job!</h2>
                  <p className="text-muted-foreground">
                    You've completed all 4 questions.
                  </p>
                </div>
                <Separator />
                <Button onClick={restartGame} size="lg" className="w-full">
                  <RotateCcw className="w-5 h-5" />
                  Play Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
