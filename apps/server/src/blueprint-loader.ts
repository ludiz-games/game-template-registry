import { readFileSync } from "fs";
import { join } from "path";

export interface BlueprintConfig {
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
 * Load a blueprint configuration from JSON file or provided config
 */
export async function loadBlueprint(options: {
  blueprintId: string;
  config?: BlueprintConfig;
}): Promise<BlueprintConfig> {
  const { blueprintId, config } = options;

  // If config is provided directly, use it
  if (config) {
    console.log(`[Blueprint] Using provided config for ${blueprintId}`);
    return config;
  }

  // Otherwise load from server folder (POC)
  try {
    const blueprintPath = join(process.cwd(), "blueprint.json");
    const blueprintData = readFileSync(blueprintPath, "utf8");
    const blueprint = JSON.parse(blueprintData) as BlueprintConfig;

    console.log(
      `[Blueprint] Loaded ${blueprint.name} v${blueprint.version} from server folder`
    );
    return blueprint;
  } catch (error) {
    throw new Error(`Failed to load blueprint '${blueprintId}': ${error}`);
  }
}

/**
 * Validate that a blueprint configuration is valid
 */
export function validateBlueprint(blueprint: BlueprintConfig): void {
  if (!blueprint.id || !blueprint.schema || !blueprint.machine) {
    throw new Error("Blueprint must have id, schema, and machine properties");
  }

  if (!blueprint.schema.root || !blueprint.schema.classes) {
    throw new Error("Blueprint schema must have root and classes properties");
  }

  if (!blueprint.machine.initial || !blueprint.machine.states) {
    throw new Error(
      "Blueprint machine must have initial and states properties"
    );
  }

  // Validate that root class exists
  if (!blueprint.schema.classes[blueprint.schema.root]) {
    throw new Error(
      `Blueprint schema root class '${blueprint.schema.root}' not found in classes`
    );
  }
}
