import type { ScenarioPlugin } from "../core/scenario-definition";

export const screenshotsPlugin: ScenarioPlugin = {
  name: "screenshots",
  beforeScenario: async (_ctx) => {
    // screenshot capture happens per-step via ctx.screenshots.capture()
  },
  afterScenario: async (_ctx) => {
    // manifest stored in ctx.screenshots.manifest
  },
  onFailure: async (_error, _ctx) => {
    // preserve captured screenshots
  },
};
