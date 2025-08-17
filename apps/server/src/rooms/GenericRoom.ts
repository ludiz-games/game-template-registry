import { Client, Room } from "@colyseus/core";
import type { Schema } from "@colyseus/schema";
import { BasePlayer, BaseState } from "@repo/colyseus-types";
import {
  loadBlueprintBundle,
  type BlueprintBundle,
  type DynamicRoomOptions,
} from "./bundle-loader";

export class GenericRoom extends Room<Schema | BaseState> {
  maxClients = 64;

  private bundle: BlueprintBundle | null = null;

  async onCreate(options: DynamicRoomOptions) {
    const { projectId, blueprintId, version } = options || {};

    this.setMetadata({ projectId, blueprintId, version });

    this.bundle = await loadBlueprintBundle(options);

    if (this.bundle?.State) {
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
    const state = this.state as BaseState;
    if (
      state &&
      state.players &&
      state.players.set &&
      !state.players.get(client.sessionId)
    ) {
      const p = new BasePlayer();
      p.name = options?.name || "Player";
      state.players.set(client.sessionId, p);
    }
  }

  onLeave(client: Client) {
    const state = this.state as BaseState;
    if (state && state.players && state.players.delete) {
      state.players.delete(client.sessionId);
    }
  }
}

export default GenericRoom;
