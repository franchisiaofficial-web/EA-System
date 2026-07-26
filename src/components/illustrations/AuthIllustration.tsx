'use client';

import { motion } from 'framer-motion';

export function AuthIllustration() {
  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative"
      >
        <svg viewBox="0 0 360 280" className="w-full" fill="none">
          <defs>
            <linearGradient id="grad1" x1="0" y1="0" x2="1" y2="0">
              <stop
                offset="0%"
                stopColor="var(--cli-blue)"
                stopOpacity="0.12"
              />
              <stop
                offset="100%"
                stopColor="var(--cli-emerald)"
                stopOpacity="0.08"
              />
            </linearGradient>
          </defs>

          <motion.rect
            x={20}
            y={40}
            width={140}
            height={52}
            rx={10}
            fill="url(#grad1)"
            stroke="var(--cli-blue)"
            strokeWidth="1.2"
            strokeOpacity="0.3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          />
          <motion.text
            x={90}
            y={72}
            textAnchor="middle"
            className="fill-foreground"
            fontSize="13"
            fontFamily="var(--font-jetbrains-mono)"
            fontWeight="600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            Dashboard
          </motion.text>

          <motion.rect
            x={200}
            y={40}
            width={140}
            height={52}
            rx={10}
            fill="url(#grad1)"
            stroke="var(--cli-emerald)"
            strokeWidth="1.2"
            strokeOpacity="0.3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
          <motion.text
            x={270}
            y={72}
            textAnchor="middle"
            className="fill-foreground"
            fontSize="13"
            fontFamily="var(--font-jetbrains-mono)"
            fontWeight="600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            Reports
          </motion.text>

          <motion.rect
            x={20}
            y={120}
            width={140}
            height={52}
            rx={10}
            fill="url(#grad1)"
            stroke="var(--cli-purple)"
            strokeWidth="1.2"
            strokeOpacity="0.3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          />
          <motion.text
            x={90}
            y={152}
            textAnchor="middle"
            className="fill-foreground"
            fontSize="13"
            fontFamily="var(--font-jetbrains-mono)"
            fontWeight="600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            Attendance
          </motion.text>

          <motion.rect
            x={200}
            y={120}
            width={140}
            height={52}
            rx={10}
            fill="url(#grad1)"
            stroke="var(--cli-amber)"
            strokeWidth="1.2"
            strokeOpacity="0.3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          />
          <motion.text
            x={270}
            y={152}
            textAnchor="middle"
            className="fill-foreground"
            fontSize="13"
            fontFamily="var(--font-jetbrains-mono)"
            fontWeight="600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.6 }}
          >
            Academics
          </motion.text>

          <motion.rect
            x={80}
            y={200}
            width={200}
            height={56}
            rx={12}
            fill="var(--card)"
            stroke="var(--cli-blue)"
            strokeWidth="1.6"
            strokeOpacity="0.4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          />
          <motion.text
            x={180}
            y={224}
            textAnchor="middle"
            className="fill-foreground"
            fontSize="14"
            fontFamily="var(--font-jetbrains-mono)"
            fontWeight="700"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.8 }}
          >
            ❯ EA System
          </motion.text>
          <motion.text
            x={180}
            y={242}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="10"
            fontFamily="var(--font-jetbrains-mono)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.9 }}
          >
            one platform, every school
          </motion.text>

          <motion.circle
            cx={180}
            cy={228}
            r={85}
            fill="none"
            stroke="var(--cli-blue)"
            strokeWidth="0.6"
            strokeDasharray="4 6"
            strokeOpacity="0.15"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.6 }}
          />
        </svg>
      </motion.div>
    </div>
  );
}
