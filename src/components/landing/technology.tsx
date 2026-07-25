'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const chips = [
  'Next.js',
  'React',
  'TypeScript',
  'Supabase',
  'PostgreSQL',
  'Prisma ORM',
  'Better Auth',
  'Tailwind CSS',
  'shadcn/ui',
  'Supabase Realtime',
  'Supabase Storage',
];

export function Technology() {
  return (
    <section id="technology" className="py-16 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-bold font-sans mb-8">
          Built Using Modern Technologies
        </h2>
        <motion.div
          className="flex flex-wrap justify-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5, staggerChildren: 0.05 }}
        >
          {chips.map((chip) => (
            <motion.span
              key={chip}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-muted/50 text-sm font-mono text-muted-foreground',
                'hover:text-foreground hover:border-cli-border hover:bg-muted transition-colors'
              )}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3 }}
            >
              {chip}
            </motion.span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
