import type { ScenarioPlugin } from "../core/scenario-definition";
import { runAccessibility } from "../helpers/accessibility";

export const accessibilityPlugin: ScenarioPlugin = {
  name: "accessibility",
  beforeScenario: async (_ctx) => {
    // accessibility scan runs per-step, not per-scenario
  },
  afterScenario: async (ctx) => {
    const result = await runAccessibility(ctx.page);
    (ctx as any)._accessibility = result;
  },
  onFailure: async (_error, _ctx) => {
    // accessibility state preserved
  },
};
