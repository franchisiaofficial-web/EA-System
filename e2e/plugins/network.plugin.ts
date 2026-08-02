import type { ScenarioPlugin } from "../core/scenario-definition";

export const networkPlugin: ScenarioPlugin = {
  name: "network",
  beforeScenario: async (ctx) => {
    ctx.network.startCapture();
  },
  afterScenario: async (_ctx) => {
    // network capture continues until page closes
  },
  onFailure: async (_error, _ctx) => {
    // network entries already captured
  },
};
