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
        'w-full max-w-[420px] rounded-2xl border border-border/60 bg-card p-8 shadow-sm',
        className
      )}
    >
      {children}
    </motion.div>
  );
}
