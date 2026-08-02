import type { ScenarioPlugin } from "../core/scenario-definition";

export const databasePlugin: ScenarioPlugin = {
  name: "database",
  beforeScenario: async (_ctx) => {
    // verify pre-conditions
  },
  afterScenario: async (_ctx) => {
    // verify post-conditions
  },
  onFailure: async (_error, _ctx) => {
    // preserve database verification state
  },
};
