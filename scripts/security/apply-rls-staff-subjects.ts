import 'dotenv/config';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const url = process.env.DIRECT_URL;
if (!url) throw new Error('DIRECT_URL required');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;
  let dollarTag: string | null = null;
  let single = false;
  let escaped = false;
  while (i < sql.length) {
    const ch = sql[i];
    if (dollarTag) {
      current += ch;
      if (sql.startsWith(dollarTag, i)) {
        current += dollarTag.slice(1);
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      i++;
      continue;
    }
    if (single) {
      current += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === "'") single = false;
      i++;
      continue;
    }
    if (ch === "'") {
      single = true;
      current += ch;
      i++;
      continue;
    }
    if (ch === '$') {
      const m = /^\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$/.exec(sql.slice(i));
      if (m) {
        dollarTag = m[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    if (ch === ';') {
      const t = current.trim();
      if (t) statements.push(t);
      current = '';
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  const t = current.trim();
  if (t) statements.push(t);
  return statements;
}

async function main() {
  const sql = readFileSync(join(process.cwd(), 'prisma', 'rls-staff-subjects.sql'), 'utf8');
  const noComments = sql
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  const statements = splitStatements(noComments).filter(s => s.length > 0);
  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log('OK:', stmt.slice(0, 60));
    } catch (e: any) {
      console.log('SKIP:', e.message?.slice(0, 120));
      console.log('  STMT:', stmt.slice(0, 200).replace(/\s+/g, ' '));
    }
  }
}

main().finally(() => prisma.$disconnect());
