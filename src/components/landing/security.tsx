import { Lock, Shield, FileText, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';

const schools = [
  { name: 'School A', accent: 'border-l-cli-cyan' },
  { name: 'School B', accent: 'border-l-cli-emerald' },
  { name: 'School C', accent: 'border-l-cli-amber' },
] as const;

const trustItems = [
  {
    icon: Lock,
    label: 'Secure Authentication',
    description: 'Role-based access with encrypted sessions',
  },
  {
    icon: Shield,
    label: 'Data Encryption',
    description: 'All data encrypted at rest and in transit',
  },
  {
    icon: FileText,
    label: 'Audit Logs',
    description: 'Complete activity tracking and compliance',
  },
  {
    icon: Cloud,
    label: 'Reliable Infrastructure',
    description: '99.9% uptime with automatic backups',
  },
] as const;

export function Security() {
  return (
    <section id="security" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold font-sans text-center mb-16">
          Enterprise-Grade Security &amp; Multi-Tenancy
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left: Isolation Diagram */}
          <div className="border border-border rounded-xl p-6 bg-card/50">
            <div className="flex gap-6 items-stretch">
              <div className="flex flex-col gap-4 flex-1">
                {schools.map((school) => (
                  <div
                    key={school.name}
                    className={cn(
                      'border border-border rounded-lg p-4 bg-card text-sm font-mono border-l-2',
                      school.accent
                    )}
                  >
                    <p className="text-foreground">{school.name}</p>
                    <p className="text-cli-muted text-xs mt-1">
                      Isolated Database &amp; Storage
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex items-center">
                <div className="flex flex-col gap-1.5">
                  {schools.map((_, i) => (
                    <span key={i} className="block w-6 h-px bg-cli-muted/30" />
                  ))}
                </div>
              </div>

              <div className="flex items-center flex-1">
                <div className="border border-border rounded-lg p-6 bg-card text-sm font-mono text-center w-full">
                  <p className="text-foreground font-semibold">
                    EA System Platform
                  </p>
                  <p className="text-cli-muted text-xs mt-2 leading-relaxed">
                    Shared Infrastructure · Secure Isolation · Unified
                    Management
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Trust Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {trustItems.map((item) => (
              <div
                key={item.label}
                className="border border-border rounded-lg p-5 bg-card"
              >
                <item.icon className="size-5 text-cli-cyan mb-3" />
                <h3 className="font-semibold text-sm mb-1">{item.label}</h3>
                <p className="text-muted-foreground text-sm">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
