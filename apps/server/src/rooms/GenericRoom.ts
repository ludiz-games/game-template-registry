import { Client, Room } from "@colyseus/core";
import type { Schema } from "@colyseus/schema";
import { BasePlayer, BaseState } from "@repo/colyseus-types";
import {
  loadBlueprintBundle,
  type BlueprintBundle,
  type DynamicRoomOptions,
} from "./bundle-loader.js";

export class GenericRoom extends Room<Schema | BaseState> {
  maxClients = 64;

  private bundle: BlueprintBundle | null = null;

  async onCreate(options: DynamicRoomOptions) {
    const { projectId, blueprintId, version } = options || {};

    this.setMetadata({ projectId, blueprintId, version });

    this.bundle = await loadBlueprintBundle(options);

    // Check if bundle has a DSL and schema builder result
    if (this.bundle?.dsl && typeof this.bundle.register === "function") {
      // The register function will handle state creation with the schema builder
      console.log(
        "[GenericRoom] Bundle has DSL, letting register function handle state creation"
      );
    } else if (this.bundle?.State) {
      this.setState(new this.bundle.State());
    } else {
      this.setState(new BaseState());
    }

    if (typeof this.bundle?.register === "function") {
      await this.bundle.register(this as any, {
        projectId: projectId || "unknown",
        blueprintId: blueprintId || "unknown",
        version: version || "latest",
        clock: this.clock,
        getConfig: async () => {
          return options?.config ?? {};
        },
      });
    }
  }

  onJoin(client: Client, options?: { name?: string }) {
    console.log(
      `[GenericRoom] Client ${client.sessionId} joining with options:`,
      options
    );

    // Try to add player if state has players map
    const state = this.state as any;
    if (state && state.players && typeof state.players.set === "function") {
      if (!state.players.get(client.sessionId)) {
        // If we have a dynamically generated Player class from the bundle, use it
        // Otherwise fall back to BasePlayer
        let player;
        if (
          (this as any)._dynamicClasses?.get &&
          (this as any)._dynamicClasses.get("Player")
        ) {
          const PlayerClass = (this as any)._dynamicClasses.get("Player");
          if (PlayerClass) {
            player = new PlayerClass();
            player.name = options?.name || "Player";
            player.score = 0;
          }
        }

        if (!player) {
          // Fallback to BasePlayer
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
}

export default GenericRoom;
