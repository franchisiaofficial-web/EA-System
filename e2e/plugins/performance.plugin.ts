import type { ScenarioPlugin } from "../core/scenario-definition";

export const performancePlugin: ScenarioPlugin = {
  name: "performance",
  beforeScenario: async (_ctx) => {
    // performance timing starts automatically via ctx.performance.measure()
  },
  afterScenario: async (_ctx) => {
    // results stored in ctx.performance.results
  },
  onFailure: async (_error, _ctx) => {
    // preserve partial performance data
  },
};
