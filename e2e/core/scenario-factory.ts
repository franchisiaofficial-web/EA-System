import type { ScenarioDefinition } from "./scenario-definition";

export function createScenario(def: Omit<ScenarioDefinition, "enabled"> & { enabled?: boolean }): ScenarioDefinition {
  return {
    ...def,
    enabled: def.enabled ?? false,
  };
}
