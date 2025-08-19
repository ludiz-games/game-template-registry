# Ludiz AI-Powered Game Editor

This directory contains the AI-powered game editor and tooling app (formerly "vibe").

**Repository:** https://github.com/ludiz-games/editor

## About

The editor is a Next.js application that provides:
- AI tools for game development
- File explorer and preview capabilities  
- Chat interface for AI assistance
- Sandbox management and real-time collaboration
- Integration with game templates and components

## Development

The actual editor files have been moved to their own repository. To work on the editor:

1. Clone the separate repository:
   ```bash
   git clone https://github.com/ludiz-games/editor.git
   cd editor
   pnpm install
   pnpm dev
   ```

2. The editor integrates with:
   - Game template registry for component management
   - Colyseus server for real-time features
   - Various AI tools and services

## Architecture

Based on the original structure, the editor includes:
- `/app` - Next.js 13+ app directory
- `/components` - React components (AI elements, file explorer, etc.)
- `/ai` - AI tools and gateway integration
- `/database` - Database schema and configuration
- `/lib` - Utility functions and configurations

## Note

This is currently a placeholder. The actual editor files need to be restored or recreated in the separate repository.
