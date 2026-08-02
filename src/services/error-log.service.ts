import { authPrisma } from "@/lib/prisma/auth-client";
import type { Prisma } from "@/generated/prisma/client";

function sanitizeMetadata(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return value;

  if (Array.isArray(value)) return value.map(sanitizeMetadata);

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const dangerous = ["stack", "stacktrace", "file", "fileName", "file_name", "path", "connectionString", "connection_string", "connection_url", "connectionUrl", "sql", "query", "password", "secret", "token", "key", "env", "environment"];

  for (const [k, v] of Object.entries(obj)) {
    if (dangerous.some((d) => k.toLowerCase().includes(d))) {
      out[k] = "[REDACTED]";
    } else if (typeof v === "object") {
      out[k] = sanitizeMetadata(v);
    } else if (typeof v === "string" && (v.includes("C:\\") || v.includes("/Users/") || v.includes("postgresql://") || v.includes("mysql://"))) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = v;
    }
  }
  return out;
}

type ErrorLogInput = {
  service: string;
  module: string;
  route?: string;
  severity?: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  category?: "DATABASE" | "API" | "AUTHENTICATION" | "STORAGE" | "REALTIME" | "VALIDATION" | "PERMISSION" | "NETWORK" | "BACKGROUND_JOB" | "SYSTEM" | "UNKNOWN";
  message: string;
  errorCode?: string;
  schoolId?: string;
  tenantId?: string;
  userId?: string;
  correlationId?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function logError(input: ErrorLogInput) {
  const correlationId = input.correlationId || `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const existing = await authPrisma.errorLog.findFirst({
    where: {
      service: input.service,
      module: input.module,
      errorCode: input.errorCode ?? null,
      message: input.message,
      status: "OPEN",
    },
    select: { id: true, occurrenceCount: true },
  });

  if (existing) {
    return authPrisma.errorLog.update({
      where: { id: existing.id },
      data: {
        occurrenceCount: existing.occurrenceCount + 1,
        lastOccurredAt: new Date(),
        metadata: sanitizeMetadata(input.metadata) as any ?? undefined,
      },
    });
  }

  return authPrisma.errorLog.create({
    data: {
      service: input.service,
      module: input.module,
      route: input.route,
      severity: (input.severity as any) ?? "ERROR",
      category: (input.category as any) ?? "SYSTEM",
      message: input.message,
      errorCode: input.errorCode,
      schoolId: input.schoolId,
      tenantId: input.tenantId,
      userId: input.userId,
      correlationId,
      metadata: sanitizeMetadata(input.metadata) as any,
    },
  });
}

export async function getErrorLogs(opts: {
  page?: number; pageSize?: number;
  severity?: string; status?: string; service?: string; module?: string;
  category?: string; search?: string;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));

  const where: any = {};
  if (opts.severity) where.severity = opts.severity;
  if (opts.status) where.status = opts.status;
  if (opts.service) where.service = opts.service;
  if (opts.module) where.module = opts.module;
  if (opts.category) where.category = opts.category;
  if (opts.search) {
    where.OR = [
      { message: { contains: opts.search, mode: "insensitive" } },
      { service: { contains: opts.search, mode: "insensitive" } },
      { module: { contains: opts.search, mode: "insensitive" } },
      { errorCode: { contains: opts.search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    authPrisma.errorLog.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { lastOccurredAt: "desc" },
    }),
    authPrisma.errorLog.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getErrorLogById(id: string) {
  return authPrisma.errorLog.findUnique({ where: { id } });
}

export async function updateErrorLog(id: string, data: { status?: string; severity?: string; resolvedAt?: string | null }, userId?: string, schoolId?: string) {
  const existing = await authPrisma.errorLog.findUnique({ where: { id }, select: { status: true, severity: true } });
  if (!existing) return null;

  const updated = await authPrisma.errorLog.update({
    where: { id },
    data: {
      ...(data.status ? { status: data.status as any } : {}),
      ...(data.severity ? { severity: data.severity as any } : {}),
      ...(data.resolvedAt !== undefined ? { resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : null } : {}),
    },
  });

  // Write audit trail entry (immutable correction record)
  if (userId) {
    await authPrisma.auditLog.create({
      data: {
        userId, schoolId,
        action: "error_status_changed",
        entity: "ErrorLog",
        recordId: id,
        before: { status: existing.status, severity: existing.severity },
        after: { status: updated.status, severity: updated.severity },
      },
    });
  }

  return updated;
}

export async function getRecentErrors(limit = 10) {
  return authPrisma.errorLog.findMany({
    orderBy: { lastOccurredAt: "desc" },
    take: limit,
  });
}
