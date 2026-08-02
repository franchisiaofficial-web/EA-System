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

export async function measure(
  label: string,
  fn: () => Promise<void>,
  iterations = 10
): Promise<PerformanceResult> {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await fn();
    times.push(Date.now() - start);
  }
  times.sort((a, b) => a - b);

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const median =
    times.length % 2 === 0
      ? (times[times.length / 2 - 1] + times[times.length / 2]) / 2
      : times[Math.floor(times.length / 2)];
  const p90 = times[Math.floor(times.length * 0.9)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const variance = times.reduce((sum, t) => sum + (t - avg) ** 2, 0) / times.length;

  return {
    samples: iterations,
    average: Math.round(avg),
    median,
    p90,
    p95,
    min: times[0],
    max: times[times.length - 1],
    stddev: Math.round(Math.sqrt(variance)),
  };
}
