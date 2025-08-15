import { Schema, type, MapSchema } from "@colyseus/schema";

export class BasePlayer extends Schema {
  @type("string") name: string = "";
  @type("number") score: number = 0;
  @type({ map: "number" }) resources = new MapSchema<number>();
}

export class Outline extends Schema {
  @type("string") currentId: string = "intro";
}

export class Timer extends Schema {
  @type("string") id: string = "";
  @type("number") remainingMs: number = 0;
}

export class BaseState extends Schema {
  @type(Outline) outline = new Outline();
  @type({ map: BasePlayer }) players = new MapSchema<BasePlayer>();
  @type({ map: "number" }) resources = new MapSchema<number>();
  @type({ map: Timer }) timers = new MapSchema<Timer>();
  @type({ map: "number" }) extNum = new MapSchema<number>();
  @type({ map: "string" }) extStr = new MapSchema<string>();
  @type("string") phase: string = "idle";
}
