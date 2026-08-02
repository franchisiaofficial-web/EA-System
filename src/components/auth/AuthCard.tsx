'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function AuthCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'w-full max-w-[420px] rounded-2xl border border-border bg-card p-8 shadow-[0_4px_24px_rgba(15,23,42,0.08)]',
        className
      )}
    >
      {children}
    </motion.div>
  );
}
