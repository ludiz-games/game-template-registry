import { Client, Room } from "@colyseus/core";
import type { Schema } from "@colyseus/schema";
import {
  BasePlayer,
  BaseState,
  type DynamicRoomOptions,
} from "@repo/colyseus-types";
import { standardActions } from "../blueprint-actions.js";
import {
  loadBlueprint,
  validateBlueprint,
  type BlueprintConfig,
} from "../blueprint-loader.js";
import { schemaBuilder } from "../schema-builder.js";
import { XStateInterpreter } from "../xstate-interpreter.js";

/**
 * 100% Generic Room - Everything driven by JSON blueprint configuration
 * No hardcoded game logic, pure data-driven architecture
 */
export class GenericRoom extends Room<Schema | BaseState> {
  maxClients = 64;

  private blueprint: BlueprintConfig | null = null;
  private interpreter: XStateInterpreter | null = null;
  private dynamicClasses: Map<string, new () => any> | null = null;

  async onCreate(options: DynamicRoomOptions) {
    const { projectId, blueprintId, version } = options || {};

    this.setMetadata({ projectId, blueprintId, version });
    console.log(`[GenericRoom] Creating room for blueprint: ${blueprintId}`);

    try {
      // Load blueprint configuration (pure JSON)
      console.log(`[GenericRoom] 🔍 Loading blueprint for: ${blueprintId}`);
      console.log(`[GenericRoom] 🔍 Options:`, options);

      this.blueprint = await loadBlueprint({
        blueprintId: blueprintId || "multi-quiz",
        config: (options as any)?.blueprint, // Allow passing blueprint directly
      });

      validateBlueprint(this.blueprint);
      console.log(
        `[GenericRoom] ✅ Loaded blueprint: ${this.blueprint.name} v${this.blueprint.version}`
      );
      console.log(
        `[GenericRoom] 🎯 Blueprint machine:`,
        this.blueprint.machine
      );

      // Build runtime schema from blueprint DSL
      const { StateClass, classes, instantiateWithDefaults } =
        schemaBuilder.build(this.blueprint.schema);
      this.dynamicClasses = classes;

      // Set the dynamically generated state
      const state = instantiateWithDefaults();
      this.setState(state);

      // Create interpreter context
      const interpreterContext = {
        room: this,
        state,
        context: { ...this.blueprint.machine.context, ...this.blueprint.data },
        data: this.blueprint.data,
        clock: this.clock,
      };

      // Create XState interpreter with only generic actions
      console.log(`[GenericRoom] 🤖 Creating XState interpreter...`);
      this.interpreter = new XStateInterpreter(
        this.blueprint.machine,
        standardActions, // Only generic actions, no hardcoded game logic
        interpreterContext
      );
      console.log(`[GenericRoom] ✅ XState interpreter created`);

      // Wire up message handlers
      console.log(`[GenericRoom] 📡 Setting up message handlers...`);
      this.setupMessageHandlers();
      console.log(`[GenericRoom] ✅ Message handlers ready`);
    } catch (error) {
      console.error("[GenericRoom] Failed to initialize blueprint:", error);
      throw error;
    }
  }

  private setupMessageHandlers() {
    // Completely generic message forwarding - no hardcoded message types
    // Get all possible events from the state machine
    const allEvents = this.getAllEventsFromMachine();

    for (const eventType of allEvents) {
      this.onMessage(eventType, (client, message) => {
        console.log(
          `[GenericRoom] 📨 '${eventType}' from ${client.sessionId}:`,
          message
        );
        this.interpreter?.send(eventType, {
          sessionId: client.sessionId,
          ...message,
        });
      });
    }

    console.log(`[GenericRoom] 📡 Registered handlers for events:`, allEvents);
  }

  onJoin(client: Client, options?: { name?: string }) {
    console.log(
      `[GenericRoom] Client ${client.sessionId} joining with options:`,
      options
    );

    const state = this.state as any;
    if (state && state.players && typeof state.players.set === "function") {
      if (!state.players.get(client.sessionId)) {
        let player;

        if (this.dynamicClasses?.get("Player")) {
          const PlayerClass = this.dynamicClasses.get("Player");
          if (PlayerClass) {
            player = new PlayerClass();
            player.name = options?.name || "Player";
            player.score = 0;
          }
        }

        if (!player) {
          player = new BasePlayer();
          player.name = options?.name || "Player";
        }

        state.players.set(client.sessionId, player);
        console.log(
          `[GenericRoom] Added player ${player.name} with session ${client.sessionId}`
        );
      }
    }
  }

  onLeave(client: Client) {
    console.log(`[GenericRoom] Client ${client.sessionId} leaving`);
    const state = this.state as any;
    if (state && state.players && typeof state.players.delete === "function") {
      state.players.delete(client.sessionId);
    }
  }

  private getAllEventsFromMachine(): string[] {
    if (!this.blueprint?.machine?.states) return [];

    const events = new Set<string>();

    // Extract all event types from all states
    for (const state of Object.values(this.blueprint.machine.states)) {
      if ((state as any).on) {
        for (const eventType of Object.keys((state as any).on)) {
          events.add(eventType);
        }
      }
    }

    return Array.from(events);
  }

  onDispose() {
    console.log("[GenericRoom] Room disposing");
    this.interpreter?.dispose();
  }
}

export default GenericRoom;
