// Dynamic room types for definition system
export interface DynamicRoomOptions {
  projectId?: string;
  definitionId?: string;
  version?: string;
  name?: string;
  config?: Record<string, any>;
  bundleUrl?: string;
}
