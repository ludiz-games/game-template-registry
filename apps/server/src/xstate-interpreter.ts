import jsonLogic from "json-logic-js";
import {
  createActor,
  createMachine,
  type Actor,
  type AnyStateMachine,
} from "xstate";
import { resolveTokens } from "./template.js";

export interface InterpreterContext {
  room: any;
  state: any; // The replicated room state
  context: Record<string, any>; // Machine context (not replicated)
  data: Record<string, any>; // Static data (quiz questions, etc.)
  clock: any;
}

export interface ActionImplementations {
  [actionName: string]: (
    ctx: InterpreterContext,
    params?: any
  ) => void | Promise<void>;
}

/**
 * XState-based interpreter that replaces our custom state machine interpreter
 * This provides much better reliability and features than our custom implementation
 */
export class XStateInterpreter {
  private machine: AnyStateMachine;
  private service: Actor<AnyStateMachine>;
  private actions: ActionImplementations;
  private roomContext: InterpreterContext;
  private lastEvent: any | null = null;

  constructor(
    machineConfig: any,
    actions: ActionImplementations,
    roomContext: InterpreterContext
  ) {
    this.actions = actions;
    this.roomContext = roomContext;

    // Convert our JSON config to XState format and create machine
    console.log(`[XState] Creating machine with config:`, machineConfig);

    const processedConfig = {
      ...machineConfig,
      // Replace action strings with actual action implementations
      on: this.replaceActionsInTransitions(machineConfig.on),
      states: this.replaceActionsInStates(machineConfig.states),
    };

    console.log(
      `[XState] Processed machine config:`,
      JSON.stringify(processedConfig, null, 2)
    );

    this.machine = createMachine(processedConfig, {
      actions: this.createXStateActions(),
      guards: this.createXStateGuards(),
    });

    console.log(`[XState] Machine created successfully`);

    // Create and start the service (XState v5 syntax)
    this.service = createActor(this.machine);
    this.service.start();

    console.log(`[XState] Started machine: ${machineConfig.id}`);
  }

  /**
   * Send an event to the state machine
   */
  send(event: string, payload?: any) {
    console.log(`[XState] Sending event: ${event}`, payload);
    console.log(`[XState] Current state: ${this.getCurrentState()}`);

    // Check if the current state can handle this event
    const currentSnapshot = this.service.getSnapshot();
    console.log(`[XState] Current snapshot:`, {
      value: currentSnapshot.value,
      status: currentSnapshot.status,
    });

    // Capture the last event payload for action parameter merging
    this.lastEvent = { type: event, ...(payload || {}) };

    // Don't spread payload to avoid overwriting the event type
    const eventToSend = { type: event, payload };
    console.log(`[XState] Sending to XState:`, eventToSend);

    this.service.send(eventToSend);
    console.log(`[XState] New state: ${this.getCurrentState()}`);
  }

  /**
   * Get current state
   */
  getCurrentState(): string {
    return this.service.getSnapshot().value as string;
  }

  /**
   * Get machine context
   */
  getContext(): any {
    return this.service.getSnapshot().context;
  }

  /**
   * Cleanup when room is disposed
   */
  dispose() {
    console.log("[XState] Stopping machine service");
    this.service.stop();
  }

  /**
   * Convert our action strings to XState action objects
   */
  private createXStateActions() {
    const xstateActions: Record<string, any> = {};

    console.log(`[XState] Creating actions for:`, Object.keys(this.actions));

    for (const [actionName, actionFn] of Object.entries(this.actions)) {
      xstateActions[actionName] = (context: any, event: any, meta: any) => {
        console.log(`[XState] Action ${actionName} - meta:`, meta);
        console.log(`[XState] Action ${actionName} - event:`, event);

        // Prefer explicit params provided on the action (meta.params),
        // fallback to event payload for backwards compatibility
        const actionParams = (meta && (meta as any).params) ?? event ?? {};
        const triggeringEvent = this.lastEvent || {};

        // Don't merge if action params have the same type as action name (avoid overwriting)
        const rawParams = { ...actionParams };
        if (rawParams.type === actionName) {
          delete rawParams.type;
        }
        // Add session info from triggering event
        if (triggeringEvent.sessionId && !rawParams.sessionId) {
          rawParams.sessionId = triggeringEvent.sessionId;
        }
        const view = {
          event: triggeringEvent,
          state: this.roomContext.state,
          context: this.roomContext.context,
          data: this.roomContext.data,
        };
        const mergedParams = resolveTokens(rawParams, view);

        console.log(`[XState] Executing action: ${actionName}`, {
          actionParams,
          triggeringEvent,
          rawParams,
          mergedParams,
        });
        try {
          actionFn(this.roomContext, mergedParams);
        } catch (error) {
          console.error(
            `[XState] Error executing action ${actionName}:`,
            error
          );
        }
      };
    }

    console.log(`[XState] Created XState actions:`, Object.keys(xstateActions));

    return xstateActions;
  }

  /**
   * Create XState guards from JSONLogic conditions
   */
  private createXStateGuards() {
    const guards: Record<string, any> = {};

    // Add a generic JSONLogic guard
    guards.jsonLogic = (context: any, event: any, { cond }: any) => {
      if (!cond) return true;

      const data = {
        event: event,
        context: context,
        state: this.roomContext.state,
        data: this.roomContext.data,
      };

      const result = jsonLogic.apply(cond, data);
      console.log(`[XState] Guard evaluation:`, {
        cond,
        data: { event, state: this.roomContext.state.phase },
        result,
      });
      return result;
    };

    return guards;
  }

  /**
   * Replace action strings in transitions with XState action objects
   */
  private replaceActionsInTransitions(transitions: any): any {
    if (!transitions) return transitions;

    const result: any = {};
    for (const [event, transition] of Object.entries(transitions)) {
      console.log(
        `[XState] Processing transition for event '${event}':`,
        transition
      );
      if (Array.isArray(transition)) {
        result[event] = transition.map((t, index) => {
          console.log(`[XState] Processing transition ${index}:`, t);
          return this.replaceActionsInTransition(t);
        });
      } else {
        result[event] = this.replaceActionsInTransition(transition);
      }
      console.log(`[XState] Final transition for '${event}':`, result[event]);
    }
    return result;
  }

  /**
   * Replace action strings in a single transition
   */
  private replaceActionsInTransition(transition: any): any {
    if (typeof transition === "string") {
      return { target: transition };
    }

    if (transition.actions) {
      // Convert action objects to XState format
      const actions = Array.isArray(transition.actions)
        ? transition.actions
        : [transition.actions];
      const xstateActions = actions.map((action: any) => {
        if (typeof action === "object" && action.type) {
          // Return action with its parameters
          console.log(`[XState] Converting action:`, action);
          return {
            type: action.type,
            params: action,
          };
        }
        return action;
      });

      // Handle guards (conditions) for transitions
      const result: any = {
        ...transition,
        actions: xstateActions,
      };

      if (transition.cond) {
        result.guard = ({ event, context }: any) => {
          const data = {
            event,
            context,
            state: this.roomContext.state,
            data: this.roomContext.data,
          };
          const guardResult = jsonLogic.apply(transition.cond, data);
          console.log(`[XState] Guard check:`, {
            cond: transition.cond,
            event,
            statePhase: (this.roomContext.state as any)?.phase,
            result: guardResult,
          });
          return guardResult;
        };
        // Remove original 'cond' to avoid conflicts with XState guard processing
        delete (result as any).cond;
      }

      return result;
    }

    return transition;
  }

  /**
   * Replace action strings in states
   */
  private replaceActionsInStates(states: any): any {
    if (!states) return states;

    const result: any = {};
    for (const [stateName, stateConfig] of Object.entries(
      states as Record<string, any>
    )) {
      // Helper to normalize actions and attach params so they are accessible via meta.params
      const mapActions = (actions: any[]) =>
        actions.map((action) =>
          typeof action === "object" && action.type
            ? { type: action.type, params: action }
            : action
        );

      result[stateName] = {
        ...stateConfig,
        on: this.replaceActionsInTransitions(stateConfig.on),
        after: stateConfig.after
          ? this.replaceActionsInAfterTransitions(stateConfig.after)
          : undefined,
        entry: stateConfig.entry
          ? mapActions(
              Array.isArray(stateConfig.entry)
                ? stateConfig.entry
                : [stateConfig.entry]
            )
          : undefined,
        exit: stateConfig.exit
          ? mapActions(
              Array.isArray(stateConfig.exit)
                ? stateConfig.exit
                : [stateConfig.exit]
            )
          : undefined,
      };
    }
    return result;
  }

  /**
   * Replace action strings in after transitions (delayed transitions)
   */
  private replaceActionsInAfterTransitions(afterConfig: any): any {
    if (!afterConfig) return afterConfig;

    const result: any = {};
    for (const [delay, transition] of Object.entries(afterConfig)) {
      if (Array.isArray(transition)) {
        result[delay] = transition.map((t) =>
          this.replaceActionsInTransition(t)
        );
      } else {
        result[delay] = this.replaceActionsInTransition(transition);
      }
    }
    return result;
  }
}
