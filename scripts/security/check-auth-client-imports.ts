/**
 * Architecture Guard — prevents accidental authPrisma imports.
 *
 * The authPrisma client (src/lib/prisma/auth-client) bypasses RLS and
 * must only be imported within:
 *   src/lib/auth/**
 *
 * Any import of auth-client outside this directory is a violation.
 *
 * To add a legitimate new import:
 *   1. Update the ALLOWED_DIRS below
 *   2. Update Decision 14 in docs/DECISIONS.md with justification
 *   3. Include this script change in the same PR
 *
 * Exit code: 0 = clean, 1 = violations found
 *
 * Usage: npx tsx scripts/security/check-auth-client-imports.ts
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ALLOWED_DIRS = ['src/lib/auth'];
const ALLOWED_FILES: string[] = [];

const AUTH_CLIENT_IMPORT =
  /from\s+['"]@\/lib\/prisma\/auth-client['"]|from\s+['"].*\/auth-client['"]|import\s+.*authPrisma.*from\s+['"]@\/lib\/prisma\/auth-client['"]/;

interface Violation {
  file: string;
  line: number;
  importStatement: string;
}

function walkSrc(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === '.next' || entry === '.git') {
          continue;
        }
        results.push(...walkSrc(fullPath));
      } else if (
        /\.(ts|tsx)$/.test(extname(entry)) &&
        !entry.endsWith('.d.ts')
      ) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory may not exist — skip
  }
  return results;
}

function isAllowed(file: string): boolean {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/');

  if (ALLOWED_FILES.includes(rel)) return true;

  return ALLOWED_DIRS.some((dir) => {
    return rel.startsWith(dir + '/') || rel === dir;
  });
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (AUTH_CLIENT_IMPORT.test(line)) {
      violations.push({
        file: relative(process.cwd(), filePath),
        line: i + 1,
        importStatement: line.trim(),
      });
    }
  }

  return violations;
}

function main(): void {
  const allFiles = walkSrc(join(process.cwd(), 'src'));
  const allViolations: Violation[] = [];

  for (const file of allFiles) {
    if (isAllowed(file)) continue;
    const violations = scanFile(file);
    allViolations.push(...violations);
  }

  if (allViolations.length === 0) {
    console.log('\n✓ No unauthorized authPrisma imports found.\n');
    process.exit(0);
  }

  console.log(
    `\n✗ Found ${allViolations.length} unauthorized authPrisma import(s):\n`
  );
  for (const v of allViolations) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    ${v.importStatement}`);
    console.log(
      `    → authPrisma must only be imported within: ${ALLOWED_DIRS.join(', ')} or files: ${ALLOWED_FILES.join(', ')}`
    );
    console.log(
      `    → To extend, update Decision 14 and this script's ALLOWED_DIRS\n`
    );
  }

  process.exit(1);
}

main();
