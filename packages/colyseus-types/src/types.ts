// Dynamic room types for blueprint system
export interface DynamicRoomOptions {
  projectId?: string;
  blueprintId?: string;
  version?: string;
  name?: string;
  config?: Record<string, any>;
  bundleUrl?: string;
}
