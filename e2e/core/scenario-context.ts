import type { Page } from "@playwright/test";

export interface ScenarioContext {
  page: Page;
  scenarioId: string;
  scenarioName: string;
  evidence: EvidenceCollector;
  network: NetworkCollector;
  performance: PerformanceCollector;
  screenshots: ScreenshotCollector;
  database: DatabaseVerifier;
}

export interface EvidenceCollector {
  beginScenario(id: string): void;
  endScenario(id: string): void;
  failScenario(id: string, reason: string): void;
  generateSummary(): unknown;
}

export interface NetworkCollector {
  entries: NetworkEntry[];
  startCapture(): void;
}

export interface NetworkEntry {
  method: string;
  url: string;
  status: number;
  timestamp: string;
  requestBody?: unknown;
  responseBody?: unknown;
}

export interface PerformanceCollector {
  results: Record<string, PerformanceResult>;
  measure(label: string, fn: () => Promise<void>, iterations?: number): Promise<PerformanceResult>;
}

export interface PerformanceResult {
  samples: number;
  average: number;
  median: number;
  p90: number;
  p95: number;
  min: number;
  max: number;
  stddev: number;
}

export interface ScreenshotCollector {
  manifest: ScreenshotManifestEntry[];
  capture(scenario: string, name: string): Promise<ScreenshotManifestEntry>;
}

export interface ScreenshotManifestEntry {
  filename: string;
  sha256: string;
  size: number;
  createdAt: string;
  scenario: string;
}

export interface DatabaseVerifier {
  verifyStudent(studentId: string): Promise<unknown>;
  verifyGuardian(studentId: string, guardianId: string): Promise<boolean>;
  verifyRelationship(studentId: string, guardianId: string): Promise<boolean>;
}
