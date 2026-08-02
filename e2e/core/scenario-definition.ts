import type { ScenarioContext } from "./scenario-context";

export interface ScenarioDefinition {
  id: string;
  name: string;
  enabled: boolean;
  execute(context: ScenarioContext): Promise<void>;
}

export interface ScenarioPlugin {
  name: string;
  beforeScenario(context: ScenarioContext): Promise<void>;
  afterScenario(context: ScenarioContext): Promise<void>;
  onFailure(error: Error, context: ScenarioContext): Promise<void>;
}
