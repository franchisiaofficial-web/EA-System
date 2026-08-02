'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HeroProps {
  headline?: 'primary' | 'alt';
}

const PHRASES = [
  '12 modules online',
  'multi-tenant: active',
  'uptime: 99.9%',
] as const;

const HEADLINES: Record<'primary' | 'alt', string> = {
  primary: 'The Operating System for Modern Schools',
  alt: 'One Platform. Every School Operation. Complete Control.',
};

const TRUST_ITEMS = [
  'Multi-School SaaS Platform',
  'Secure Cloud Infrastructure',
  'Role-Based Access Control',
  'Real-Time Analytics',
] as const;

const SCHOOLS = [
  { id: 'a', label: 'School A', x: 10, y: 55 },
  { id: 'b', label: 'School B', x: 10, y: 170 },
  { id: 'c', label: 'School C', x: 10, y: 285 },
] as const;

interface ConnectorLabel {
  text: string;
  x: number;
  y: number;
}

const CONNECTOR_LABELS: ConnectorLabel[] = [
  { text: 'attendance', x: 260, y: 113 },
  { text: 'fees', x: 340, y: 148 },
  { text: 'exams', x: 280, y: 182 },
  { text: 'transport', x: 350, y: 192 },
  { text: 'messages', x: 300, y: 272 },
];

const SCHOOL_NODE_WIDTH = 168;
const SCHOOL_NODE_HEIGHT = 40;
const CENTRAL_NODE_WIDTH = 228;
const CENTRAL_NODE_HEIGHT = 84;
const CENTRAL_NODE_X = 455;
const CENTRAL_NODE_Y = 145;

function getSchoolRightEdgeX(): number {
  return SCHOOLS[0].x + SCHOOL_NODE_WIDTH;
}

function getSchoolCenterY(y: number): number {
  return y + SCHOOL_NODE_HEIGHT / 2;
}

function getCentralLeftEdgeX(): number {
  return CENTRAL_NODE_X;
}

function getCentralCenterY(): number {
  return CENTRAL_NODE_Y + CENTRAL_NODE_HEIGHT / 2;
}

const CONNECTOR_PATHS = SCHOOLS.map((school) => {
  const sx = getSchoolRightEdgeX();
  const sy = getSchoolCenterY(school.y);
  const ex = getCentralLeftEdgeX();
  const ey = getCentralCenterY();
  return `M ${sx},${sy} C ${sx + 110},${sy} ${ex - 90},${ey} ${ex},${ey}`;
});

export function Hero({ headline = 'primary' }: HeroProps) {
  const prefersReducedMotion = useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      mql.addEventListener('change', onStoreChange);
      return () => mql.removeEventListener('change', onStoreChange);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false
  );

  const [displayText, setDisplayText] = useState(
    prefersReducedMotion ? PHRASES[0] : ''
  );
  const [cursorVisible, setCursorVisible] = useState(!prefersReducedMotion);
  const [animPhase, setAnimPhase] = useState(prefersReducedMotion ? 3 : 0);

  const phraseIdxRef = useRef(0);
  const charIdxRef = useRef(0);
  const isErasingRef = useRef(false);
  const pauseCountRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const interval = setInterval(() => {
      const phrase = PHRASES[phraseIdxRef.current];

      if (pauseCountRef.current > 0) {
        pauseCountRef.current--;
        return;
      }

      if (!isErasingRef.current) {
        if (charIdxRef.current < phrase.length) {
          charIdxRef.current++;
          setDisplayText(phrase.slice(0, charIdxRef.current));
        } else {
          pauseCountRef.current = 30;
          isErasingRef.current = true;
        }
      } else {
        if (charIdxRef.current > 0) {
          charIdxRef.current--;
          setDisplayText(phrase.slice(0, charIdxRef.current));
        } else {
          isErasingRef.current = false;
          phraseIdxRef.current = (phraseIdxRef.current + 1) % PHRASES.length;
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 530);

    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const t1 = setTimeout(() => setAnimPhase(1), 600);
    const t2 = setTimeout(() => setAnimPhase(2), 1600);
    const t3 = setTimeout(() => setAnimPhase(3), 2700);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [prefersReducedMotion]);

  const headlineText = HEADLINES[headline];

  return (
    <section className="relative w-full overflow-hidden py-16 md:py-24 lg:py-32 px-4 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <p
            className="font-mono text-sm text-cli-cyan"
            aria-label="Platform status"
          >
            <span aria-hidden="true">{'\u276F'} status --platform</span>
          </p>
          <p
            className="mt-2 font-mono text-sm text-cli-cyan"
            aria-live="polite"
            aria-label={`Status: ${displayText}`}
          >
            <span aria-hidden="true">{'\u276F'} </span>
            <span>{displayText}</span>
            {cursorVisible && (
              <span
                className="inline-block w-[0.6em] h-[1.1em] bg-cli-cyan align-text-bottom ml-0.5 animate-pulse"
                aria-hidden="true"
              />
            )}
          </p>
        </div>

        <h1
          className={cn(
            'font-mono font-bold max-w-4xl mx-auto text-center text-5xl sm:text-7xl leading-tight tracking-tight text-foreground'
          )}
        >
          {headlineText}
        </h1>

        <p className="mt-6 mx-auto max-w-2xl text-center text-lg md:text-xl text-muted-foreground leading-relaxed">
          EA System is a cloud-based, multi-tenant School ERP built for schools
          of every size. Manage admissions, academics, attendance, finance,
          transport, communication, HR, examinations, and analytics from one
          secure platform.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" className="px-8 py-3 text-base bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
            Start Free Trial
          </Button>
          <Button variant="outline" size="lg" className="px-8 py-3 text-base border-border text-foreground/80 hover:text-foreground hover:bg-muted/50">
            Book a Live Demo
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {TRUST_ITEMS.map((item) => (
            <div
              key={item}
              className="flex items-center gap-2 font-mono text-sm text-muted-foreground"
            >
              <Check className="size-4 shrink-0 text-cli-emerald" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className="relative mt-16 h-[420px] w-full select-none">
          <motion.svg
            viewBox="0 0 750 420"
            className="h-full w-full"
            initial={false}
            aria-hidden="true"
          >
            <defs>
              <filter id="glow-cli-blue">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {SCHOOLS.map((school, i) => {
              const sx = school.x;
              const sy = school.y;
              const nodeAnim =
                prefersReducedMotion || animPhase >= 0
                  ? { opacity: 1 }
                  : { opacity: 0 };

              return (
                <motion.g
                  key={school.id}
                  initial={
                    prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }
                  }
                  animate={nodeAnim}
                  transition={{ duration: 0.4, delay: i * 0.2 + 0.1 }}
                >
                  <rect
                    x={sx}
                    y={sy}
                    width={SCHOOL_NODE_WIDTH}
                    height={SCHOOL_NODE_HEIGHT}
                    rx={6}
                    className="fill-cli-surface/50 stroke-cli-border"
                    strokeWidth={2}
                  />
                  <text
                    x={sx + 14}
                    y={sy + SCHOOL_NODE_HEIGHT / 2 + 1}
                    dominantBaseline="middle"
                    className="fill-cli-text font-mono text-xs"
                  >
                    {'\u276F'} {school.label}
                  </text>
                </motion.g>
              );
            })}

            <motion.g
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={
                prefersReducedMotion || animPhase >= 0
                  ? { opacity: 1 }
                  : { opacity: 0 }
              }
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <rect
                x={CENTRAL_NODE_X}
                y={CENTRAL_NODE_Y}
                width={CENTRAL_NODE_WIDTH}
                height={CENTRAL_NODE_HEIGHT}
                rx={8}
                className="fill-cli-surface/50 stroke-cli-blue"
                strokeWidth={2}
                filter="url(#glow-cli-blue)"
              />
              <text
                x={CENTRAL_NODE_X + CENTRAL_NODE_WIDTH / 2}
                y={CENTRAL_NODE_Y + CENTRAL_NODE_HEIGHT / 2 - 6}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-cli-cyan font-mono text-sm font-bold"
              >
                {'\u276F'} EA System
              </text>
              <text
                x={CENTRAL_NODE_X + CENTRAL_NODE_WIDTH / 2}
                y={CENTRAL_NODE_Y + CENTRAL_NODE_HEIGHT / 2 + 16}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-cli-text-secondary font-mono text-[10px]"
              >
                Cloud Platform
              </text>
            </motion.g>

            {CONNECTOR_PATHS.map((d, i) => (
              <motion.path
                key={`connector-${i}`}
                d={d}
                fill="none"
                className="stroke-cli-border"
                strokeWidth={1.5}
                initial={
                  prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }
                }
                animate={{ pathLength: animPhase >= 1 ? 1 : 0 }}
                transition={{ duration: 0.8, delay: 0.3 + i * 0.15 }}
              />
            ))}

            <AnimatePresence>
              {animPhase >= 2 && (
                <motion.g
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ staggerChildren: 0.12, delayChildren: 0.05 }}
                >
                  {CONNECTOR_LABELS.map((label, i) => (
                    <motion.g
                      key={label.text}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: i * 0.12 }}
                    >
                      <text
                        x={label.x}
                        y={label.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-cli-text-secondary font-mono text-[10px]"
                      >
                        {label.text}
                      </text>
                    </motion.g>
                  ))}
                </motion.g>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {animPhase >= 3 && (
                <motion.g
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <text
                    x={CENTRAL_NODE_X + CENTRAL_NODE_WIDTH / 2}
                    y={CENTRAL_NODE_Y + CENTRAL_NODE_HEIGHT + 34}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-cli-text-secondary font-mono text-xs"
                  >
                    One Platform. Every Department. Every School.
                  </text>
                </motion.g>
              )}
            </AnimatePresence>
          </motion.svg>
        </div>
      </div>
    </section>
  );
}
