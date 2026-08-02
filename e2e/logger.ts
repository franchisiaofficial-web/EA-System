type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

let currentLevel: LogLevel = "INFO";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function log(level: LogLevel, message: string): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return;
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level}]`;
  if (level === "ERROR") console.error(`${prefix} ${message}`);
  else if (level === "WARN") console.warn(`${prefix} ${message}`);
  else console.log(`${prefix} ${message}`);
}
