'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const tiers = [
  {
    name: 'Basic',
    monthlyPrice: 99,
    annualPrice: 79,
    description: 'Perfect for single schools getting started',
    features: [
      'Up to 500 students',
      'Core modules (Admissions, Academics, Attendance)',
      'Basic analytics dashboard',
      'Email support',
      '1 admin account',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Professional',
    monthlyPrice: 249,
    annualPrice: 199,
    description: 'For growing schools that need full control',
    features: [
      'Up to 2,000 students',
      'All 12 modules unlocked',
      'Advanced analytics & reports',
      'Priority email + chat support',
      'Multi-admin role management',
      'API access',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    monthlyPrice: null,
    annualPrice: null,
    description: 'For school groups & large institutions',
    features: [
      'Unlimited students',
      'All Professional features',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
      'On-premise deployment option',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="py-24 px-4 bg-muted/30">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold font-sans text-center mb-4">
          Simple, Transparent Pricing
        </h2>

        <div className="flex items-center justify-center mb-12">
          <div className="inline-flex items-center rounded-lg border border-border p-1">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
                !annual
                  ? 'bg-cli-blue text-white'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5',
                annual
                  ? 'bg-cli-blue text-white'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              Annual
              {annual && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded"
                >
                  Save 20%
                </motion.span>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className={cn(
                'relative border border-border rounded-xl p-8 bg-card flex flex-col',
                tier.highlighted && 'border-cli-blue ring-1 ring-cli-blue/30'
              )}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 right-4 bg-cli-blue text-white text-xs px-2 py-0.5 rounded">
                  Popular
                </span>
              )}

              <h3 className="text-xl font-semibold font-sans">{tier.name}</h3>

              <div className="mt-4 mb-2">
                {tier.monthlyPrice !== null ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold font-mono">
                      ${annual ? tier.annualPrice : tier.monthlyPrice}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      /month
                    </span>
                  </div>
                ) : (
                  <span className="text-4xl font-bold font-mono">
                    Let&apos;s Talk
                  </span>
                )}
              </div>

              <p className="text-sm text-muted-foreground mb-6">
                {tier.description}
              </p>

              <ul className="space-y-3 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="h-5 w-5 text-cli-emerald shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={tier.highlighted ? 'default' : 'outline'}
                className={cn(
                  'mt-8 w-full',
                  tier.highlighted && 'bg-cli-blue hover:bg-cli-blue/90'
                )}
              >
                {tier.cta}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
