import type { ScenarioContext } from "./scenario-context";
import type { ScenarioPlugin } from "./scenario-definition";
import { log } from "../logger";

export class PluginManager {
  private plugins: ScenarioPlugin[] = [];

  register(plugin: ScenarioPlugin): void {
    this.plugins.push(plugin);
    log("INFO", `Plugin registered: ${plugin.name}`);
  }

  async executeBeforeHooks(ctx: ScenarioContext): Promise<void> {
    for (const plugin of this.plugins) {
      try {
        await plugin.beforeScenario(ctx);
      } catch (e) {
        log("ERROR", `Plugin ${plugin.name} beforeScenario failed: ${(e as Error).message}`);
      }
    }
  }

  async executeAfterHooks(ctx: ScenarioContext): Promise<void> {
    for (const plugin of [...this.plugins].reverse()) {
      try {
        await plugin.afterScenario(ctx);
      } catch (e) {
        log("ERROR", `Plugin ${plugin.name} afterScenario failed: ${(e as Error).message}`);
      }
    }
  }

  async executeFailureHooks(error: Error, ctx: ScenarioContext): Promise<void> {
    for (const plugin of this.plugins) {
      try {
        await plugin.onFailure(error, ctx);
      } catch (e) {
        log("ERROR", `Plugin ${plugin.name} onFailure failed: ${(e as Error).message}`);
      }
    }
  }
}
