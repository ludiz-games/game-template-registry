# Ludiz-Vibe Component Registry

A custom component registry for serious game and educational components built for the Ludiz-Vibe AI-powered learning platform.

## Overview

This registry provides reusable, interactive components specifically designed for serious games, educational content, and learning experiences. Components are built with accessibility, gamification, and learning outcomes in mind.

## Available Components

### 🧠 Ultra-Focused Game Building Blocks

- **MCQ Choices** (`mcq-component`) - Pure choice selection component (no timer, title, or submit logic)
- **True/False Buttons** (`true-false-component`) - Focused True/False selection buttons
- **Quiz Timer** (`quiz-timer`) - Standalone timer with progress bar and warning states

### Design Philosophy

Each component is **ultra-focused** on a single responsibility:

- 🎯 **Single Purpose** - Each component does one thing extremely well
- 🧩 **Composable** - Combine components to build complex game experiences
- 🔧 **Controlled/Uncontrolled** - Support both patterns for maximum flexibility
- 🎨 **Accessible** - WCAG compliant with keyboard navigation
- 📱 **Responsive** - Works across all device sizes

## Usage

### Install Components

```bash
# Install a specific component
npx shadcn@latest add http://localhost:3002/registry/mcq-component

# Install all ludiz-vibe components
npx shadcn@latest add http://localhost:3002/registry/mcq-component \
  http://localhost:3002/registry/true-false-component \
  http://localhost:3002/registry/quiz-timer
```

### Example Usage

```tsx
import { MCQComponent } from "@/components/mcq-component";
import { QuizTimer } from "@/components/quiz-timer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const choices = [
  { id: "1", text: "Option A", isCorrect: false },
  { id: "2", text: "Option B", isCorrect: true },
  { id: "3", text: "Option C", isCorrect: false },
];

function QuizPage() {
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle>What is the main component of Mars' atmosphere?</CardTitle>
          <QuizTimer totalTime={30} onTimeUp={() => setShowFeedback(true)} />
        </div>
      </CardHeader>
      <CardContent>
        <MCQComponent
          choices={choices}
          selectedChoice={selectedChoice}
          onChoiceSelect={setSelectedChoice}
          showFeedback={showFeedback}
          disabled={showFeedback}
        />
      </CardContent>
    </Card>
  );
}
```

## Development

### Running the Registry

```bash
# Start development server
pnpm --filter=@repo/registry dev

# Build registry files
pnpm --filter=@repo/registry registry:build

# Build for production
pnpm --filter=@repo/registry build
```

### Adding New Components

1. Create component directory: `registry/ludiz/[component-name]/`
2. Add component file: `[component-name].tsx`
3. Update `registry.json` with component metadata
4. Run `pnpm registry:build` to generate static files

### Component Guidelines

- **Educational Focus**: Components should support learning objectives
- **Accessibility**: Follow WCAG 2.1 AA guidelines
- **Gamification**: Include engaging interactions and feedback
- **Reusability**: Design for multiple contexts and subjects
- **Performance**: Optimize for real-time multiplayer scenarios

## API Endpoints

- `GET /registry/[component-name]` - Get component definition and files
- `GET /` - Registry homepage with component browser

## Integration with Ludiz-Vibe

These components are designed to work seamlessly with:

- **Colyseus Multiplayer** - Real-time state synchronization
- **AI SDK** - AI-generated questions and adaptive content
- **Convex Backend** - Progress tracking and analytics
- **Design Toolchain** - Visual component composition

## Contributing

When adding new components:

1. Focus on serious game mechanics (scoring, progression, feedback)
2. Support both single-player and multiplayer scenarios
3. Include comprehensive TypeScript types
4. Add proper documentation and examples
5. Test with various content types and subjects

## License

MIT License - Part of the Ludiz-Vibe project ecosystem.
