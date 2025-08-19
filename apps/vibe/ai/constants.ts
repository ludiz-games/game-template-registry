import { type GatewayModelId } from "@ai-sdk/gateway";

export const DEFAULT_MODEL: GatewayModelId[number] = "openai/gpt-5";

export const SUPPORTED_MODELS: GatewayModelId[] = [
  "anthropic/claude-4-sonnet",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "moonshotai/kimi-k2",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-oss-120b",
];

export const TEST_PROMPTS = [
  "Generate quizz game on the theme of basket ball",
  'Create a `golang` server that responds with "Hello World" to any request',
];
