'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqItems = [
  {
    question: 'What is EA System?',
    answer:
      'EA System is a cloud-based, multi-tenant School ERP platform that centralizes every aspect of school management — from admissions and academics to finance, transport, and communication — into one secure system.',
  },
  {
    question: 'Can EA System manage multiple schools?',
    answer:
      'Yes. EA System is built on a multi-tenant architecture that lets you manage multiple schools with completely isolated data while using the same platform and infrastructure.',
  },
  {
    question: 'Is my data secure?',
    answer:
      "Absolutely. All data is encrypted at rest and in transit. We use role-based access controls, comprehensive audit logging, and secure cloud infrastructure to protect your institution's information.",
  },
  {
    question: 'What modules are included?',
    answer:
      'EA System includes 12 integrated modules: Admissions, Academics, Attendance, Examinations, Finance, HR, Transport, Communication, Library, Hostel, Inventory, and Analytics.',
  },
  {
    question: 'Do you offer a free trial?',
    answer:
      'Yes! We offer a 14-day free trial with full access to all features. No credit card required. You can explore the platform at your own pace.',
  },
  {
    question: 'Can EA System integrate with our existing systems?',
    answer:
      'EA System provides API access on Professional and Enterprise plans, allowing integration with existing SIS, LMS, and payment systems. Our team can help with custom integrations.',
  },
  {
    question: 'How long does implementation take?',
    answer:
      'Most schools are up and running within 1-2 weeks. We provide onboarding support, data migration assistance, and training for your team.',
  },
];

function FaqItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left py-4 text-lg font-medium hover:text-cli-blue transition-colors"
      >
        <span>{question}</span>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-muted-foreground leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-24 px-4 bg-muted/30">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold font-sans text-center mb-12">
          Frequently Asked Questions
        </h2>

        <div className="space-y-0">
          {faqItems.map((item, index) => (
            <FaqItem
              key={index}
              question={item.question}
              answer={item.answer}
              isOpen={openIndex === index}
              onToggle={() => handleToggle(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
