# Phase 4 E2E Testing Framework

## Architecture

```
e2e/
├── fixtures/       Playwright test fixtures (auth, school, student, guardian, database)
├── helpers/        Core utilities (evidence, network, screenshots, validator, accessibility, performance)
├── collectors/     Evidence aggregation and summary generation
├── scenarios/      E1–E8 Playwright spec files
├── reports/        Generated verification reports
├── templates/      JSON and Markdown templates for summaries/reports
└── config/         Scenario registry and configuration
```

## Folder Layout

- **fixtures/**: Reusable Playwright fixtures providing authenticated sessions, CRUD operations, and database verification
- **helpers/**: Stateless utility functions for screenshot capture, network interception, performance measurement, accessibility scanning, and evidence validation
- **collectors/**: `e2e-evidence.ts` orchestrates evidence collection — scenario begin/end, summary generation, validation
- **scenarios/**: `e1–e8.spec.ts` files, one per Phase 4 scenario, each containing `test.describe` blocks with placeholder tests
- **config/**: `scenarios.json` (enable/disable per scenario), `duplicate-allowlist.json` (expected duplicate screenshot pairs)

## Execution Flow

```
Playwright worker starts
        ↓
Auth fixture authenticates
        ↓
Scenario.begin() → records networkIdxStart
        ↓
Test steps execute (screenshots captured, network intercepted)
        ↓
Scenario.end() → records networkIdxEnd, marks PASS
        ↓
(On failure) Scenario marked FAIL with reason
        ↓
After all scenarios: validateEvidence()
        ↓
Generate summary.json
        ↓
Update latest.json pointer
```

## Evidence Lifecycle

1. **Capture**: `screenshots.ts` saves PNG with SHA-256 hash to `evidence/runs/<timestamp>/`
2. **Network**: `network.ts` intercepts all `/api/*` requests
3. **Store**: `scenarios.json` tracks per-scenario status, indices, and failure reasons
4. **Validate**: `validator.ts` checks duplicates, missing files, index ranges
5. **Summarize**: `e2e-evidence.ts` generates `e2e-summary.json`

## Reporting Lifecycle

1. After evidence validation: `generateSummary()` writes `e2e-summary.json`
2. `latest.json` points to the most recent run
3. Verification report generated from `verification-report.template.md` populated with runtime data

## Recovery Behaviour

- Checkpoint saves: after every scenario completion
- Failed runs: `.fail.json` written alongside main summary, never overwrites
- Resume: `loadState()` reads previous PASS/PARTIAL state and skips completed scenarios

## Append-Only Storage

- Each run creates a timestamped directory under `evidence/runs/`
- Previous runs are never modified or deleted
- `latest.json` pointer updated atomically after each complete run

## Validator Pipeline

```
validateEvidence()
        ↓
validateScenarios() — check networkIdxStart/End bounds
        ↓
detectDuplicates() — group by SHA-256, check allow-list
        ↓
File checks — existence, size > 0
        ↓
Return errors array (empty = PASS)
```

## Scenario Registry

```json
{
  "E1": { "name": "Student Lifecycle", "enabled": false },
  "E2": { "name": "Guardian Lifecycle", "enabled": false },
  "E3": { "name": "Cross Tenant", "enabled": false },
  "E4": { "name": "Search", "enabled": false },
  "E5": { "name": "Validation", "enabled": false },
  "E6": { "name": "Error Handling", "enabled": false },
  "E7": { "name": "Accessibility", "enabled": false },
  "E8": { "name": "Performance", "enabled": false }
}
```

All scenarios disabled by default until infrastructure recovery and scenario implementation.

## Dependencies

- `@playwright/test` — test runner
- `@axe-core/playwright` — accessibility scanning (optional, not installed)

## Getting Started

After infrastructure recovery:

```bash
npx playwright test e2e/scenarios/
```

Individual scenarios:

```bash
npx playwright test e2e/scenarios/e1-student-lifecycle.spec.ts
```
