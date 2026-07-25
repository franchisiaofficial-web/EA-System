'use client';

import { motion } from 'framer-motion';

const SCHOOLS = [
  { label: 'School A', x: 80, y: 80, color: 'var(--cli-cyan)' },
  { label: 'School B', x: 320, y: 60, color: 'var(--cli-emerald)' },
  { label: 'School C', x: 200, y: 320, color: 'var(--cli-amber)' },
];

const CARDS = [
  { label: 'Attendance', x: 60, y: 200, color: 'var(--cli-purple)' },
  { label: 'Grades', x: 340, y: 200, color: 'var(--cli-rose)' },
  { label: 'Messages', x: 200, y: 420, color: 'var(--cli-blue)' },
];

const CLOUD_CENTER = { x: 200, y: 220 };

function ConnectorLine({
  from,
  to,
  delay,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  delay: number;
}) {
  return (
    <motion.line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke="var(--cli-blue)"
      strokeWidth="1.5"
      strokeDasharray="6 4"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 0.5 }}
      transition={{ duration: 1.2, delay, ease: 'easeInOut' }}
    />
  );
}

function NodeCard({
  label,
  x,
  y,
  color,
  delay,
  width = 100,
}: {
  label: string;
  x: number;
  y: number;
  color: string;
  delay: number;
  width?: number;
}) {
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
    >
      <rect
        x={x - width / 2}
        y={y - 18}
        width={width}
        height={36}
        rx={8}
        fill="var(--card)"
        stroke={color}
        strokeWidth="1.5"
        className="drop-shadow-sm"
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        className="fill-foreground"
        fontSize="11"
        fontFamily="var(--font-jetbrains-mono)"
      >
        {label}
      </text>
    </motion.g>
  );
}

export function AuthIllustration() {
  return (
    <div className="relative hidden lg:flex items-center justify-center h-full w-full">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative"
      >
        <svg viewBox="0 0 400 480" className="w-full max-w-md" fill="none">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {SCHOOLS.map((school, i) => (
            <ConnectorLine
              key={`school-${i}`}
              from={{ x: school.x, y: school.y }}
              to={CLOUD_CENTER}
              delay={0.3 + i * 0.2}
            />
          ))}

          {CARDS.map((card, i) => (
            <ConnectorLine
              key={`card-${i}`}
              from={{ x: card.x, y: card.y }}
              to={CLOUD_CENTER}
              delay={0.9 + i * 0.2}
            />
          ))}

          <motion.g
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <rect
              x={CLOUD_CENTER.x - 60}
              y={CLOUD_CENTER.y - 30}
              width={120}
              height={60}
              rx={12}
              fill="var(--card)"
              stroke="var(--cli-blue)"
              strokeWidth="2"
              filter="url(#glow)"
            />
            <text
              x={CLOUD_CENTER.x}
              y={CLOUD_CENTER.y - 4}
              textAnchor="middle"
              className="fill-foreground"
              fontSize="12"
              fontFamily="var(--font-jetbrains-mono)"
              fontWeight="bold"
            >
              ❯ EA System
            </text>
            <text
              x={CLOUD_CENTER.x}
              y={CLOUD_CENTER.y + 14}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize="9"
              fontFamily="var(--font-jetbrains-mono)"
            >
              Cloud Platform
            </text>
          </motion.g>

          {SCHOOLS.map((school, i) => (
            <NodeCard
              key={`school-card-${i}`}
              label={school.label}
              x={school.x}
              y={school.y}
              color={school.color}
              delay={0.2 + i * 0.2}
            />
          ))}

          {CARDS.map((card, i) => (
            <NodeCard
              key={`card-node-${i}`}
              label={card.label}
              x={card.x}
              y={card.y}
              color={card.color}
              delay={0.8 + i * 0.2}
              width={90}
            />
          ))}

          <motion.circle
            cx={CLOUD_CENTER.x}
            cy={CLOUD_CENTER.y}
            r={45}
            fill="none"
            stroke="var(--cli-blue)"
            strokeWidth="1"
            strokeDasharray="4 4"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.3, scale: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
          />

          <motion.circle
            cx={CLOUD_CENTER.x}
            cy={CLOUD_CENTER.y}
            r={70}
            fill="none"
            stroke="var(--cli-blue)"
            strokeWidth="0.5"
            strokeDasharray="2 6"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.15, scale: 1 }}
            transition={{ duration: 1.5, delay: 0.7 }}
          />
        </svg>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.8 }}
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-center"
        >
          <p className="text-xs font-mono text-muted-foreground">
            Secure · Multi-Tenant · Real-Time
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
