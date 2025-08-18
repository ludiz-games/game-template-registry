import { readFileSync } from "fs";
import { join } from "path";

export interface GameDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  schema: {
    root: string;
    classes: Record<string, any>;
    defaults?: Record<string, any>;
  };
  machine: {
    id: string;
    initial: string;
    context?: Record<string, any>;
    states: Record<string, any>;
  };
  actions: string[]; // Whitelisted action names
  data: Record<string, any>; // Static game data
}

/**
 * Load a game definition from JSON file or provided config
 */
export async function loadDefinition(options: {
  definitionId: string;
  config?: GameDefinition;
}): Promise<GameDefinition> {
  const { definitionId, config } = options;

  // If config is provided directly, use it
  if (config) {
    console.log(`[Definition] Using provided config for ${definitionId}`);
    return config;
  }

  // Otherwise load from server folder (POC)
  try {
    const definitionPath = join(process.cwd(), "definition.json");
    const definitionData = readFileSync(definitionPath, "utf8");
    const definition = JSON.parse(definitionData) as GameDefinition;

    console.log(
      `[Definition] Loaded ${definition.name} v${definition.version} from server folder`
    );
    return definition;
  } catch (error) {
    throw new Error(`Failed to load definition '${definitionId}': ${error}`);
  }
}

/**
 * Validate that a game definition is valid
 */
export function validateDefinition(definition: GameDefinition): void {
  if (!definition.id || !definition.schema || !definition.machine) {
    throw new Error("Definition must have id, schema, and machine properties");
  }

  if (!definition.schema.root || !definition.schema.classes) {
    throw new Error("Definition schema must have root and classes properties");
  }

  if (!definition.machine.initial || !definition.machine.states) {
    throw new Error(
      "Definition machine must have initial and states properties"
    );
  }

  // Validate that root class exists
  if (!definition.schema.classes[definition.schema.root]) {
    throw new Error(
      `Definition schema root class '${definition.schema.root}' not found in classes`
    );
  }
}
