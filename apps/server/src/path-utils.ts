import lodashGet from "lodash.get";
import lodashSet from "lodash.set";

function isMapLike(
  value: any
): value is { get: (k: any) => any; set: (k: any, v: any) => any } {
  return (
    value && typeof value.get === "function" && typeof value.set === "function"
  );
}

function splitPath(path: string): string[] {
  // Minimal splitter for dot notation; bracket notation could be added later if needed
  return path.split(".").filter(Boolean);
}

export function getByPath(root: any, path: string): any {
  if (!path) return root;
  const parts = splitPath(path);
  let current: any = root;
  for (const part of parts) {
    if (current == null) return undefined;
    if (isMapLike(current)) {
      current = current.get(part);
    } else {
      // Use lodash.get for robustness on plain objects/arrays
      current = lodashGet(current, part);
    }
  }
  return current;
}

export function setByPath(root: any, path: string, value: any): void {
  if (!path) return;
  const parts = splitPath(path);
  let current: any = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key: string = parts[i] as string;
    if (isMapLike(current)) {
      const next = current.get(key);
      if (next == null) {
        // If we need to create intermediate object under a Map-like, create a plain object container
        const container: Record<string, any> = {};
        current.set(key, container);
        current = container;
      } else {
        current = next;
      }
    } else {
      let next = (current as any)[key];
      if (next == null) {
        next = {};
        (current as any)[key] = next;
      }
      current = next;
    }
  }
  const last: string = parts[parts.length - 1] as string;
  if (isMapLike(current)) {
    current.set(last, value);
  } else {
    lodashSet(current, last, value);
  }
}
