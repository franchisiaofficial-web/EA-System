/**
 * Password Hash Isolation Audit
 *
 * Scans application source code for queries touching User/Account tables.
 * Reports any query that could expose password hashes through application
 * services (non-authPrisma clients).
 *
 * Password hash field: `password` on the `accounts` table.
 * Application services must use explicit `select` and never request
 * the password field. BetterAuth manages password hashes internally
 * via authPrisma (DIRECT_URL).
 *
 * Exit code: 0 = clean, 1 = violations found
 *
 * Usage: npx tsx scripts/security/check-password-exposure.ts
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const AUTH_CLIENT_IMPORT = /from\s+['"]@\/lib\/prisma\/auth-client['"]/;

interface QuerySite {
  file: string;
  line: number;
  code: string;
  risk: 'SAFE' | 'AUDIT' | 'DANGER';
  detail: string;
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (
          [
            'node_modules',
            '.next',
            '.git',
            'generated',
            'features',
            'hooks',
            'middleware',
            'types',
          ].includes(entry)
        )
          continue;
        results.push(...walkDir(fullPath));
      } else if (
        /\.(ts|tsx)$/.test(extname(entry)) &&
        !entry.endsWith('.d.ts')
      ) {
        results.push(fullPath);
      }
    }
  } catch {
    // skip
  }
  return results;
}

function isAuthFile(filePath: string): boolean {
  return filePath.includes('src/lib/auth/');
}

function auditFile(filePath: string): QuerySite[] {
  const sites: QuerySite[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const usesAuthClient = AUTH_CLIENT_IMPORT.test(content);
  const isAuth = isAuthFile(filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const block = lines.slice(Math.max(0, i - 2), i + 3).join('\n');

    // Check for User model accesses
    if (/prisma\.user\./i.test(line) || /authPrisma\.user\./i.test(line)) {
      const relPath = relative(process.cwd(), filePath);
      let risk: QuerySite['risk'] = 'SAFE';
      let detail = '';

      if (usesAuthClient || isAuth) {
        risk = 'SAFE';
        detail = 'Auth infrastructure — uses authPrisma (allowed)';
      } else {
        // Check for explicit select
        const hasSelect = block.includes('select:');
        const hasInclude = block.includes('include:');
        const hasStar = /\bselect\s+\*\b/i.test(block);

        if (hasStar) {
          risk = 'DANGER';
          detail =
            'SELECT * — implicitly includes password hash column from Account table';
        } else if (hasSelect) {
          risk = 'SAFE';
          detail = 'Explicit field selection — no password exposure risk';
        } else if (hasInclude) {
          risk = 'AUDIT';
          detail =
            'Uses include — verify password hash not leaked via included relations';
        } else {
          risk = 'AUDIT';
          detail =
            'Implicit field selection — verify password hash not returned';
        }
      }

      sites.push({
        file: relPath,
        line: i + 1,
        code: line.trim().substring(0, 80),
        risk,
        detail,
      });
    }

    // Check for Account model accesses
    if (
      /prisma\.account\./i.test(line) ||
      /authPrisma\.account\./i.test(line)
    ) {
      const relPath = relative(process.cwd(), filePath);
      let risk: QuerySite['risk'] = 'SAFE';
      let detail = '';

      if (usesAuthClient || isAuth) {
        risk = 'SAFE';
        detail = 'Auth infrastructure — uses authPrisma (allowed)';
      } else {
        const hasSelect = block.includes('select:');
        const hasStar = /\bselect\s+\*\b/i.test(block);

        if (hasStar) {
          risk = 'DANGER';
          detail = 'SELECT * — may include password hash from Account table';
        } else if (hasSelect) {
          risk = 'SAFE';
          detail =
            'Explicit field selection — no password exposure risk if password excluded';
        } else {
          risk = 'DANGER';
          detail =
            'Implicit selection on Account — password hash may be leaked';
        }
      }

      sites.push({
        file: relPath,
        line: i + 1,
        code: line.trim().substring(0, 80),
        risk,
        detail,
      });
    }
  }

  return sites;
}

function main(): void {
  const allFiles = walkDir(join(process.cwd(), 'src'));
  const allSites: QuerySite[] = [];

  for (const file of allFiles) {
    allSites.push(...auditFile(file));
  }

  // Report
  const safe = allSites.filter((s) => s.risk === 'SAFE');
  const audit = allSites.filter((s) => s.risk === 'AUDIT');
  const danger = allSites.filter((s) => s.risk === 'DANGER');

  console.log('\n=== Password Hash Exposure Audit ===\n');
  console.log(`Total query sites touching User/Account: ${allSites.length}`);
  console.log(`  SAFE:   ${safe.length}`);
  console.log(`  AUDIT:  ${audit.length} (needs manual review)`);
  console.log(`  DANGER: ${danger.length}`);

  if (audit.length > 0) {
    console.log('\n--- Needs Review ---');
    for (const s of audit) {
      console.log(`  ${s.file}:${s.line} [AUDIT]`);
      console.log(`    ${s.code}`);
      console.log(`    → ${s.detail}\n`);
    }
  }

  if (danger.length > 0) {
    console.log('\n--- DANGEROUS — Password Hash May Be Exposed ---');
    for (const s of danger) {
      console.log(`  ${s.file}:${s.line} [DANGER]`);
      console.log(`    ${s.code}`);
      console.log(`    → ${s.detail}\n`);
    }
    process.exit(1);
  }

  console.log(
    '\n✓ No password hash exposure detected in application services.\n'
  );
  process.exit(0);
}

main();
