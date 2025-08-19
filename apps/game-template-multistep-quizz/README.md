# Multi-Step Quiz Game Template

This directory is a placeholder. The actual game template files have been moved to their own repository:

**Repository:** https://github.com/ludiz-games/game-template-multistep-quizz

## About

This is a Vite + React game template for multi-step quiz games that uses:
- Components from the game-template-registry
- Colyseus hooks for multiplayer functionality
- TailwindCSS for styling

## Development

To work on this game template:

1. Clone the separate repository:
   ```bash
   git clone https://github.com/ludiz-games/game-template-multistep-quizz.git
   cd game-template-multistep-quizz
   pnpm install
   pnpm dev
   ```

2. Install components from the registry:
   ```bash
   npx shadcn@latest add https://your-registry.vercel.app/registry/mcq-component
   npx shadcn@latest add https://your-registry.vercel.app/registry/true-false-component
   npx shadcn@latest add https://your-registry.vercel.app/registry/quiz-timer
   ```
