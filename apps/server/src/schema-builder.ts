import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

export interface DSLField {
  type: "string" | "number" | "boolean";
}

export interface DSLMapField {
  map: string; // className
}

export interface DSLArrayField {
  array: string; // className or primitive type
}

export interface DSLRefField {
  ref: string; // className
}

export type DSLFieldType = DSLField | DSLMapField | DSLArrayField | DSLRefField;

export interface DSLClass {
  [fieldName: string]: DSLFieldType;
}

export interface StateDSL {
  root: string; // must be "State"
  classes: {
    [className: string]: DSLClass;
  };
  defaults?: {
    [className: string]: Record<string, any>;
  };
}

export interface SchemaBuilderResult {
  classes: Map<string, new () => Schema>;
  StateClass: new () => Schema;
  instantiateWithDefaults: () => Schema;
}

/**
 * Runtime Schema builder that generates Colyseus Schema classes from JSON DSL
 */
export class SchemaBuilder {
  private generatedClasses = new Map<string, new () => Schema>();

  build(dsl: StateDSL): SchemaBuilderResult {
    this.validateDSL(dsl);
    this.generatedClasses.clear();

    // First pass: create all class constructors
    const classNames = Object.keys(dsl.classes);
    for (const className of classNames) {
      const classDef = dsl.classes[className];
      if (classDef) {
        this.createSchemaClass(className, classDef);
      }
    }

    // Second pass: resolve references and apply decorators
    for (const className of classNames) {
      const classDef = dsl.classes[className];
      if (classDef) {
        this.applyDecorators(className, classDef);
      }
    }

    const StateClass = this.generatedClasses.get(dsl.root);
    if (!StateClass) {
      throw new Error(`Root class "${dsl.root}" not found after generation`);
    }

    return {
      classes: this.generatedClasses,
      StateClass,
      instantiateWithDefaults: () =>
        this.instantiateWithDefaults(dsl, StateClass),
    };
  }

  private validateDSL(dsl: StateDSL): void {
    if (!dsl.root) {
      throw new Error("DSL must specify a root class");
    }

    if (!dsl.classes[dsl.root]) {
      throw new Error(`Root class "${dsl.root}" not found in classes`);
    }

    // Validate all references resolve
    for (const [className, classDef] of Object.entries(dsl.classes)) {
      for (const [fieldName, fieldDef] of Object.entries(classDef)) {
        if ("ref" in fieldDef) {
          if (!dsl.classes[fieldDef.ref]) {
            throw new Error(
              `Class "${className}" field "${fieldName}" references unknown class "${fieldDef.ref}"`
            );
          }
        } else if ("map" in fieldDef) {
          if (!dsl.classes[fieldDef.map]) {
            throw new Error(
              `Class "${className}" field "${fieldName}" maps to unknown class "${fieldDef.map}"`
            );
          }
        } else if ("array" in fieldDef) {
          // Allow primitive arrays (string, number, boolean) or class references
          const primitiveTypes = ["string", "number", "boolean"];
          if (
            !primitiveTypes.includes(fieldDef.array) &&
            !dsl.classes[fieldDef.array]
          ) {
            throw new Error(
              `Class "${className}" field "${fieldName}" arrays unknown class/type "${fieldDef.array}"`
            );
          }
        }
      }
    }
  }

  private createSchemaClass(className: string, classDef: DSLClass): void {
    // Create dynamic class extending Schema
    const DynamicClass = class extends Schema {
      constructor() {
        super();
        // Initialize default values for collections
        for (const [fieldName, fieldDef] of Object.entries(classDef)) {
          if ("map" in fieldDef) {
            (this as any)[fieldName] = new MapSchema();
          } else if ("array" in fieldDef) {
            (this as any)[fieldName] = new ArraySchema();
          }
        }
      }
    };

    // Set class name for debugging
    Object.defineProperty(DynamicClass, "name", { value: className });

    this.generatedClasses.set(className, DynamicClass);
  }

  private applyDecorators(className: string, classDef: DSLClass): void {
    const SchemaClass = this.generatedClasses.get(className);
    if (!SchemaClass) {
      throw new Error(`Class ${className} not found during decoration`);
    }

    for (const [fieldName, fieldDef] of Object.entries(classDef)) {
      if ("type" in fieldDef) {
        // Primitive type
        type(fieldDef.type)(SchemaClass.prototype, fieldName);
      } else if ("map" in fieldDef) {
        // Map of another class
        const targetClass = this.generatedClasses.get(fieldDef.map);
        if (!targetClass) {
          throw new Error(
            `Target class "${fieldDef.map}" not found for map field "${fieldName}"`
          );
        }
        type({ map: targetClass })(SchemaClass.prototype, fieldName);
      } else if ("array" in fieldDef) {
        // Array of another class or primitive
        const primitiveTypes = ["string", "number", "boolean"];
        if (primitiveTypes.includes(fieldDef.array)) {
          // Primitive array
          type([fieldDef.array])(SchemaClass.prototype, fieldName);
        } else {
          // Class array
          const targetClass = this.generatedClasses.get(fieldDef.array);
          if (!targetClass) {
            throw new Error(
              `Target class "${fieldDef.array}" not found for array field "${fieldName}"`
            );
          }
          type([targetClass])(SchemaClass.prototype, fieldName);
        }
      } else if ("ref" in fieldDef) {
        // Reference to another class
        const targetClass = this.generatedClasses.get(fieldDef.ref);
        if (!targetClass) {
          throw new Error(
            `Target class "${fieldDef.ref}" not found for ref field "${fieldName}"`
          );
        }
        type(targetClass)(SchemaClass.prototype, fieldName);
      }
    }
  }

  private instantiateWithDefaults(
    dsl: StateDSL,
    StateClass: new () => Schema
  ): Schema {
    const state = new StateClass();

    if (dsl.defaults) {
      this.applyDefaults(state, dsl.root, dsl.defaults);
    }

    return state;
  }

  private applyDefaults(
    instance: any,
    className: string,
    allDefaults: Record<string, Record<string, any>>
  ): void {
    const defaults = allDefaults[className];
    if (!defaults) return;

    for (const [fieldName, defaultValue] of Object.entries(defaults)) {
      if (defaultValue !== null && typeof defaultValue === "object") {
        // Handle nested objects - create instance if it doesn't exist
        if (!instance[fieldName]) {
          // This would need more sophisticated logic for refs
          continue;
        }
      } else {
        // Primitive default
        instance[fieldName] = defaultValue;
      }
    }
  }
}

// Export singleton instance
export const schemaBuilder = new SchemaBuilder();
