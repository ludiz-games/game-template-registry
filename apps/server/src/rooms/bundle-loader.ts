export type DynamicRoomOptions = {
  projectId?: string;
  blueprintId?: string;
  version?: string;
  /** Optional config blob to pass into the bundle's register() context */
  config?: Record<string, any>;
  /**
   * Optional absolute path or URL to the server bundle.
   * If provided, it bypasses resolution.
   */
  bundleUrl?: string;
};

export type BlueprintBundle = {
  /** Colyseus Schema subclass to be used as this room's state */
  State?: new () => any;
  /** Called by GenericRoom to wire message handlers, timers, etc. */
  register?: (
    room: any,
    ctx: {
      projectId: string;
      blueprintId: string;
      version: string;
      clock: any;
      getConfig: () => Promise<Record<string, any>>;
    }
  ) => void | Promise<void>;
  /** Optional metadata included in the bundle */
  metadata?: Record<string, any>;
};

/**
 * Resolve a bundle URL/path for the given project/blueprint/version.
 * In dev, we look for a local file under `./bundles/<projectId>/<blueprintId>/<version>/server.mjs`.
 * In prod, this could fetch a signed URL from storage.
 */
export async function resolveBundleUrl(
  opts: DynamicRoomOptions
): Promise<string> {
  if (opts.bundleUrl) return opts.bundleUrl;
  const projectId = opts.projectId || "dev";
  const blueprintId = opts.blueprintId || "default";
  const version = opts.version || "latest";

  // Local dev path (ESM file). Adjust as needed.
  return new URL(
    `../../bundles/${projectId}/${blueprintId}/${version}/server.mjs`,
    import.meta.url
  ).pathname;
}

/**
 * Dynamically import the bundle module. The returned object should satisfy BlueprintBundle.
 */
export async function loadBlueprintBundle(
  opts: DynamicRoomOptions
): Promise<BlueprintBundle> {
  const url = await resolveBundleUrl(opts);
  // eslint-disable-next-line no-new-func
  const mod = await import(/* @vite-ignore */ url);
  return mod as BlueprintBundle;
}
