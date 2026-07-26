/**
 * SQL Policy Linter — detects dangerous RLS policy patterns.
 *
 * Scans SQL files under prisma/, supabase/, migrations/ for:
 *   USING (true)
 *   WITH CHECK (true)
 *   current_user_id() IS NULL
 *   auth.uid() IS NULL
 *   OR TRUE  (inside policy bodies)
 *   WHERE TRUE  (inside policy bodies)
 *
 * Notes:
 *   - Only parses within USING(...) and WITH CHECK(...) blocks, not raw SQL.
 *   - Ignores comments, string literals, and identifiers.
 *   - Respects `-- security-linter-ignore` on the preceding line.
 *   - Only scans .sql and .psql files.
 *   - Skips .md files.
 *
 * Exit code: 0 = clean, 1 = violations found
 *
 * Usage: npx tsx scripts/security/check-rls.ts
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const SCAN_DIRS = ['prisma', 'supabase', 'migrations'];
const ALLOWED_EXTENSIONS = new Set(['.sql', '.psql']);

interface Violation {
  file: string;
  line: number;
  offending: string;
  explanation: string;
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...walkDir(fullPath));
      } else if (
        !entry.endsWith('.md') &&
        ALLOWED_EXTENSIONS.has(extname(entry).toLowerCase())
      ) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory may not exist — skip
  }
  return results;
}

const DANGEROUS_PATTERNS: Array<{
  regex: RegExp;
  label: string;
  explanation: string;
}> = [
  {
    regex: /USING\s*\(\s*true\s*\)/i,
    label: 'USING (true)',
    explanation:
      'Unrestricted read access — all rows visible regardless of RLS context',
  },
  {
    regex: /WITH\s+CHECK\s*\(\s*true\s*\)/i,
    label: 'WITH CHECK (true)',
    explanation:
      'Unrestricted write access — any row can be inserted/updated regardless of RLS context',
  },
  {
    regex: /current_user_id\s*\(\s*\)\s+IS\s+NULL/i,
    label: 'current_user_id() IS NULL',
    explanation:
      'RLS bypass — grants access when no authenticated user context exists',
  },
  {
    regex: /auth\.uid\s*\(\s*\)\s+IS\s+NULL/i,
    label: 'auth.uid() IS NULL',
    explanation:
      'RLS bypass — grants access when no Supabase JWT user context exists',
  },
  {
    regex: /\bOR\s+TRUE\b/i,
    label: 'OR TRUE',
    explanation: 'Logic short-circuit — makes the entire condition always pass',
  },
  {
    regex: /\bWHERE\s+TRUE\b/i,
    label: 'WHERE TRUE',
    explanation: 'Logic short-circuit — matches all rows unconditionally',
  },
];

function stripSQLComments(sql: string): string {
  return (
    sql
      // Remove single-line comments
      .replace(/--.*$/gm, '')
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
  );
}

function extractPolicyBodies(sql: string): Array<{
  body: string;
  startLine: number;
}> {
  const bodies: Array<{ body: string; startLine: number }> = [];

  const policyRegex =
    /CREATE\s+(?:OR\s+REPLACE\s+)?POLICY\s+(?:"[^"]*"|'[^']*')\s+ON\s+\S+\s+(?:FOR\s+\S+\s+)?(?:USING\s*\(([\s\S]*?)\)(?:\s*WITH\s+CHECK\s*\(([\s\S]*?)\))?|WITH\s+CHECK\s*\(([\s\S]*?)\)(?:\s*USING\s*\(([\s\S]*?)\))?)/gi;

  let match;
  while ((match = policyRegex.exec(sql)) !== null) {
    const usingClause = match[1] || match[4];
    const checkClause = match[2] || match[3];

    const combinedBody = [usingClause, checkClause].filter(Boolean).join(' ');
    if (combinedBody) {
      const lineStart = sql.substring(0, match.index).split('\n').length;
      bodies.push({ body: combinedBody, startLine: lineStart });
    }
  }

  return bodies;
}

function hasIgnoreOnPrecedingLine(lines: string[], lineIdx: number): boolean {
  for (let i = lineIdx - 1; i >= 0 && i >= lineIdx - 2; i--) {
    if (lines[i]?.includes('security-linter-ignore')) {
      return true;
    }
    if (lines[i]?.trim() !== '' && !lines[i]?.trim().startsWith('--')) {
      return false;
    }
  }
  return false;
}

function scanSQLFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const rawSql = readFileSync(filePath, 'utf-8');
  const lines = rawSql.split('\n');

  const strippedSql = stripSQLComments(rawSql);
  const policyBodies = extractPolicyBodies(strippedSql);

  for (const { body, startLine } of policyBodies) {
    for (const pattern of DANGEROUS_PATTERNS) {
      const bodyLines = body.split('\n');
      for (let i = 0; i < bodyLines.length; i++) {
        const line = bodyLines[i];
        if (pattern.regex.test(line)) {
          const absoluteLineNum = startLine + i;

          if (hasIgnoreOnPrecedingLine(lines, absoluteLineNum - 1)) {
            continue;
          }

          violations.push({
            file: filePath,
            line: absoluteLineNum,
            offending: line.trim(),
            explanation: `${pattern.label}: ${pattern.explanation}`,
          });
        }
      }
    }
  }

  return violations;
}

function main(): void {
  const allViolations: Violation[] = [];

  const cwd = process.cwd();
  for (const dir of SCAN_DIRS) {
    const fullDir = join(cwd, dir);
    const files = walkDir(fullDir);
    for (const file of files) {
      const violations = scanSQLFile(file);
      allViolations.push(...violations);
    }
  }

  if (allViolations.length === 0) {
    console.log('\n✓ No dangerous RLS policy patterns found.\n');
    process.exit(0);
  }

  console.log(
    `\n✗ Found ${allViolations.length} dangerous RLS policy pattern(s):\n`
  );
  for (const v of allViolations) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    ${v.offending.substring(0, 80)}`);
    console.log(`    → ${v.explanation}`);
    console.log();
  }

  console.log(
    'To suppress intentional patterns, add `-- security-linter-ignore` on the line before the statement.'
  );
  process.exit(1);
}

main();
