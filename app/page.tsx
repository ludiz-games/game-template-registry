import * as React from "react"
import { OpenInV0Button } from "@/components/open-in-v0-button"
import { MCQComponent } from "@/registry/ludiz/mcq-component/mcq-component"
import { TrueFalseComponent } from "@/registry/ludiz/true-false-component/true-false-component"
import { QuizTimer } from "@/registry/ludiz/quiz-timer/quiz-timer"

// This page displays items from the custom registry.
// You are free to implement this with your own design as needed.

export default function Home() {
  const [mcqSelected, setMcqSelected] = React.useState<string | null>(null);
  const [tfSelected, setTfSelected] = React.useState<boolean | null>(null);

  const sampleMcqChoices = [
    { id: "1", text: "React is a JavaScript library", isCorrect: true },
    { id: "2", text: "React is a programming language", isCorrect: false },
    { id: "3", text: "React is a database", isCorrect: false },
    { id: "4", text: "React is an operating system", isCorrect: false },
  ];

  return (
    <div className="max-w-4xl mx-auto flex flex-col min-h-svh px-4 py-8 gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Ludiz Game Components Registry</h1>
        <p className="text-muted-foreground">
          Ultra-focused, composable components for serious games and educational experiences.
        </p>
      </header>
      <main className="flex flex-col flex-1 gap-8">
        <div className="flex flex-col gap-4 border rounded-lg p-6 relative">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">MCQ Component</h2>
              <p className="text-sm text-muted-foreground">
                Multiple choice selection with feedback states
              </p>
            </div>
            <OpenInV0Button name="mcq-component" className="w-fit" />
          </div>
          <div className="flex items-center justify-center py-8">
            <div className="w-full max-w-md">
              <h3 className="text-sm font-medium mb-4">What is React?</h3>
              <MCQComponent 
                choices={sampleMcqChoices}
                selectedChoice={mcqSelected}
                onChoiceSelect={setMcqSelected}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border rounded-lg p-6 relative">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">True/False Component</h2>
              <p className="text-sm text-muted-foreground">
                Binary choice buttons with visual feedback
              </p>
            </div>
            <OpenInV0Button name="true-false-component" className="w-fit" />
          </div>
          <div className="flex items-center justify-center py-8">
            <div className="w-full max-w-md">
              <h3 className="text-sm font-medium mb-4">JavaScript is a compiled language</h3>
              <TrueFalseComponent 
                selectedAnswer={tfSelected}
                onAnswerSelect={setTfSelected}
                correctAnswer={false}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border rounded-lg p-6 relative">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Quiz Timer</h2>
              <p className="text-sm text-muted-foreground">
                Countdown timer with progress bar and warning states
              </p>
            </div>
            <OpenInV0Button name="quiz-timer" className="w-fit" />
          </div>
          <div className="flex items-center justify-center py-8">
            <div className="w-full max-w-md">
              <QuizTimer 
                totalTime={30}
                warningThreshold={10}
                size="md"
                onTimeUp={() => console.log("Time's up!")}
              />
            </div>
          </div>
        </div>

        <div className="mt-8 p-6 bg-muted/50 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Installation</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Install components using the shadcn CLI:
          </p>
          <div className="space-y-2 font-mono text-sm bg-background p-4 rounded border">
            <div>npx shadcn@latest add [REGISTRY_URL]/registry/mcq-component</div>
            <div>npx shadcn@latest add [REGISTRY_URL]/registry/true-false-component</div>
            <div>npx shadcn@latest add [REGISTRY_URL]/registry/quiz-timer</div>
          </div>
        </div>
      </main>
    </div>
  )
}
