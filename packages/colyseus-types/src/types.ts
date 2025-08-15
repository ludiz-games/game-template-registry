export type StepNode = { 
  kind: string; 
  data: any 
};

export interface RoomOptions {
  name?: string;
}

export interface UIEvent {
  type: string;
  [key: string]: any;
}
