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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={cn(
        'w-full max-w-[430px] rounded-2xl border border-border bg-card/80 p-8 shadow-xl backdrop-blur-sm',
        className
      )}
    >
      {children}
    </motion.div>
  );
}
