import { Client, Room } from "@colyseus/core";
import type { Schema } from "@colyseus/schema";
import {
  BasePlayer,
  BaseState,
  type DynamicRoomOptions,
} from "@repo/colyseus-types";
import {
  loadDefinition,
  validateDefinition,
  type GameDefinition,
} from "../definition-loader.js";
import { standardActions } from "../runtime-actions.js";
import { schemaBuilder } from "../schema-builder.js";
import { XStateInterpreter } from "../xstate-interpreter.js";

/**
 * 100% Generic Room - Everything driven by JSON game definition
 * No hardcoded game logic, pure data-driven architecture
 */
export class GenericRoom extends Room<Schema | BaseState> {
  maxClients = 64;

  private definition: GameDefinition | null = null;
  private interpreter: XStateInterpreter | null = null;
  private dynamicClasses: Map<string, new () => any> | null = null;

  async onCreate(options: DynamicRoomOptions) {
    const { projectId, definitionId, version } = options || {};

    this.setMetadata({ projectId, definitionId, version });
    console.log(`[GenericRoom] Creating room for definition: ${definitionId}`);

    try {
      // Load game definition (pure JSON)
      console.log(`[GenericRoom] 🔍 Loading definition for: ${definitionId}`);
      console.log(`[GenericRoom] 🔍 Options:`, options);

      this.definition = await loadDefinition({
        definitionId: definitionId || "multi-quiz",
        config: (options as any)?.definition, // Allow passing definition directly
      });

      validateDefinition(this.definition);
      console.log(
        `[GenericRoom] ✅ Loaded definition: ${this.definition.name} v${this.definition.version}`
      );
      console.log(
        `[GenericRoom] 🎯 Definition machine:`,
        this.definition.machine
      );

      // Build runtime schema from definition DSL
      const { StateClass, classes, instantiateWithDefaults } =
        schemaBuilder.build(this.definition.schema);
      this.dynamicClasses = classes;

      // Set the dynamically generated state
      const state = instantiateWithDefaults();
      this.setState(state);

      // Create interpreter context
      const interpreterContext = {
        room: this,
        state,
        context: {
          ...this.definition.machine.context,
          ...this.definition.data,
        },
        data: this.definition.data,
        clock: this.clock,
      };

      // Create XState interpreter with only generic actions
      console.log(`[GenericRoom] 🤖 Creating XState interpreter...`);
      this.interpreter = new XStateInterpreter(
        this.definition.machine,
        standardActions, // Only generic actions, no hardcoded game logic
        interpreterContext
      );
      console.log(`[GenericRoom] ✅ XState interpreter created`);

      // Wire up message handlers
      console.log(`[GenericRoom] 📡 Setting up message handlers...`);
      this.setupMessageHandlers();
      console.log(`[GenericRoom] ✅ Message handlers ready`);
    } catch (error) {
      console.error("[GenericRoom] Failed to initialize definition:", error);
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
    if (!this.definition?.machine?.states) return [];

    const events = new Set<string>();

    // Extract all event types from all states
    for (const state of Object.values(this.definition.machine.states)) {
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
