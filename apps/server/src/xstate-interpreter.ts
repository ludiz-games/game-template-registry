import {
  createActor,
  createMachine,
  type Actor,
  type AnyStateMachine,
} from "xstate";

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

  constructor(
    machineConfig: any,
    actions: ActionImplementations,
    roomContext: InterpreterContext
  ) {
    this.actions = actions;
    this.roomContext = roomContext;

    // Convert our JSON config to XState format and create machine
    this.machine = createMachine(
      {
        ...machineConfig,
        // Replace action strings with actual action implementations
        on: this.replaceActionsInTransitions(machineConfig.on),
        states: this.replaceActionsInStates(machineConfig.states),
      },
      {
        actions: this.createXStateActions(),
        guards: {}, // Add guards if needed later
      }
    );

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
    this.service.send({ type: event, ...payload });
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

    for (const [actionName, actionFn] of Object.entries(this.actions)) {
      xstateActions[actionName] = (context: any, event: any) => {
        console.log(`[XState] Executing action: ${actionName}`);
        try {
          actionFn(this.roomContext, { event, context });
        } catch (error) {
          console.error(
            `[XState] Error executing action ${actionName}:`,
            error
          );
        }
      };
    }

    return xstateActions;
  }

  /**
   * Replace action strings in transitions with XState action objects
   */
  private replaceActionsInTransitions(transitions: any): any {
    if (!transitions) return transitions;

    const result: any = {};
    for (const [event, transition] of Object.entries(transitions)) {
      if (Array.isArray(transition)) {
        result[event] = transition.map((t) =>
          this.replaceActionsInTransition(t)
        );
      } else {
        result[event] = this.replaceActionsInTransition(transition);
      }
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
      return {
        ...transition,
        actions: Array.isArray(transition.actions)
          ? transition.actions
          : [transition.actions],
      };
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
      result[stateName] = {
        ...stateConfig,
        on: this.replaceActionsInTransitions(stateConfig.on),
        entry: stateConfig.entry
          ? Array.isArray(stateConfig.entry)
            ? stateConfig.entry
            : [stateConfig.entry]
          : undefined,
        exit: stateConfig.exit
          ? Array.isArray(stateConfig.exit)
            ? stateConfig.exit
            : [stateConfig.exit]
          : undefined,
      };
    }
    return result;
  }
}
