import Mustache from "mustache";

export type TemplateContext = Record<string, any>;

function toMustacheSyntax(input: string): string {
  // Convert ${foo.bar} -> {{foo.bar}}
  return input.replace(/\$\{\s*([^}]+?)\s*\}/g, "{{$1}}");
}

function renderString(template: string, view: TemplateContext): string {
  const mustacheTemplate = toMustacheSyntax(template);
  return Mustache.render(mustacheTemplate, view);
}

export function resolveTokens<T = any>(value: T, view: TemplateContext): T {
  if (value == null) return value;

  if (typeof value === "string") {
    return renderString(value, view) as unknown as T;
  }

  if (Array.isArray(value)) {
    return (value as any[]).map((v) => resolveTokens(v, view)) as unknown as T;
  }

  if (typeof value === "object") {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as any)) {
      result[k] = resolveTokens(v, view);
    }
    return result as unknown as T;
  }

  return value;
}
