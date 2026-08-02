# Phase 4 — Scenario Execution Engine

## Execution Flow

```
Scenario Definition loaded
        ↓
enabled? → NO → SKIPPED
        ↓ YES
PluginManager.executeBeforeHooks()
    ├── networkPlugin.beforeScenario()     → starts network capture
    ├── databasePlugin.beforeScenario()    → verifies pre-conditions
    ├── performancePlugin.beforeScenario() → readies timing
    ├── accessibilityPlugin.beforeScenario()
    └── screenshotsPlugin.beforeScenario()
        ↓
definition.execute(ctx)
    → scenario-specific logic runs here
        ↓
PluginManager.executeAfterHooks()
    ├── screenshotsPlugin.afterScenario()
    ├── accessibilityPlugin.afterScenario()
    ├── performancePlugin.afterScenario()
    ├── databasePlugin.afterScenario()
    └── networkPlugin.afterScenario()      → (reverse order)
        ↓
Evidence validation
        ↓
Summary generation
        ↓
PASS / FAIL / SKIPPED
```

## On Failure

```
definition.execute(ctx) throws
        ↓
PluginManager.executeFailureHooks()
    → each plugin preserves its partial state
        ↓
Scenario marked FAIL with reason
        ↓
Evidence preserved (screenshots, network entries, timings)
```

## ScenarioContext

Every scenario receives a `ScenarioContext` object:

```ts
{
  page: Page,              // Playwright page
  scenarioId: string,      // "E1", "E2", etc.
  scenarioName: string,    // Human-readable name
  evidence: EvidenceCollector,     // begin/end/fail scenario hooks
  network: NetworkCollector,       // entries[] + startCapture()
  performance: PerformanceCollector, // results{} + measure()
  screenshots: ScreenshotCollector,  // manifest[] + capture()
  database: DatabaseVerifier         // verifyStudent/Guardian/Relationship()
}
```

## Plugin Architecture

Plugins implement the `ScenarioPlugin` interface:

```ts
{
  name: string;
  beforeScenario(ctx): Promise<void>;
  afterScenario(ctx): Promise<void>;
  onFailure(error, ctx): Promise<void>;
}
```

Five plugins are registered:
- **network** — API request/response interception
- **database** — pre/post condition verification
- **performance** — timing measurement
- **accessibility** — axe-core scans (when installed)
- **screenshots** — SHA-256 hashed captures

Plugins execute in registration order for `before` hooks, reverse order for `after` hooks. Failure hooks always execute for all plugins regardless of which plugin threw.

## Lifecycle

```
Scenario Created
→ Before Plugins (registration order)
→ Execute Callback
→ After Plugins (reverse registration order)
→ Validation
→ Summary
→ Cleanup
```

## Crash Recovery

If a scenario crashes:
1. `onFailure` hooks execute for every registered plugin
2. Partial network entries are preserved
3. Captured screenshots are preserved
4. Performance measurements before the crash are preserved
5. The scenario is marked `FAIL` with the error message
6. Subsequent scenarios continue execution (failure isolation)

## Scenario Factory

```ts
import { createScenario } from "e2e/core";

export default createScenario({
  id: "E1",
  name: "Student Lifecycle",
  execute: async (ctx) => {
    // scenario logic here
  },
});
```

## Extension Guide

Add a new plugin:

1. Create `e2e/plugins/my-plugin.ts`
2. Implement `ScenarioPlugin` interface
3. Register in the scenario runner's `PluginManager`:
   ```ts
   const plugins = new PluginManager();
   plugins.register(networkPlugin);
   plugins.register(myPlugin);
   ```

Add a new scenario:

1. Create `e2e/scenarios/e9-my-scenario.spec.ts`
2. Use `createScenario()` with `execute` callback
3. Register in `e2e/config/scenarios.json`

## Constants

All configurable values in `e2e/config/constants.ts`:
- `SCREENSHOT_FORMAT = "png"`
- `PERFORMANCE_ITERATIONS = 10`
- `DEFAULT_TIMEOUT = 15000`
- `DEFAULT_VIEWPORT = { width: 1440, height: 900 }`
- `API_PREFIX = "/api"`
- `REPORT_VERSION = 1`
- `BASE_URL = "http://localhost:3000"`

## Logging

```ts
import { log, setLogLevel } from "e2e/logger";

log("INFO", "Starting scenario");
log("ERROR", "Database connection failed");
setLogLevel("DEBUG"); // verbose output
```

Levels: DEBUG < INFO < WARN < ERROR. Timestamps included on every entry.
