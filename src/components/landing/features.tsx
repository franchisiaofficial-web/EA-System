import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  Shield,
  Cloud,
  MessageSquare,
  BarChart3,
  Lock,
} from 'lucide-react';

const features = [
  {
    icon: LayoutDashboard,
    label: 'Smart Dashboard',
    description: 'Real-time insights across your institution.',
    accent: 'text-cli-purple',
    span: 'md:col-span-2',
  },
  {
    icon: Building2,
    label: 'Multi-Tenant Architecture',
    description:
      'Securely manage multiple schools with completely isolated data.',
    accent: 'text-cli-blue',
    span: '',
  },
  {
    icon: Shield,
    label: 'Role-Based Access',
    description: 'Every user sees only the tools and information they need.',
    accent: 'text-cli-amber',
    span: '',
  },
  {
    icon: Cloud,
    label: 'Cloud Infrastructure',
    description: 'Access your school securely from anywhere on any device.',
    accent: 'text-cli-cyan',
    span: '',
  },
  {
    icon: MessageSquare,
    label: 'Real-Time Communication',
    description:
      'Instant communication between administrators, teachers, parents, and students.',
    accent: 'text-cli-emerald',
    span: '',
  },
  {
    icon: BarChart3,
    label: 'Analytics & Reports',
    description:
      'Monitor attendance, fee collection, academic performance, transport, and school operations through live dashboards.',
    accent: 'text-cli-purple',
    span: 'md:col-span-2',
  },
  {
    icon: Lock,
    label: 'Enterprise Security',
    description:
      'Secure authentication, encrypted data, permission-based access, audit logs, and reliable cloud infrastructure.',
    accent: 'text-cli-rose',
    span: '',
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold font-sans text-center mb-12">
          Powerful Features Built for Modern Schools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className={cn(
                  'border border-border rounded-xl p-6 bg-card hover:shadow-md transition-shadow',
                  feature.span
                )}
              >
                <Icon className={cn('mb-4 w-8 h-8', feature.accent)} />
                <h3 className="font-bold font-sans text-foreground mb-2">
                  {feature.label}
                </h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
