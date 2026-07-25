import { cn } from '@/lib/utils';

export function About() {
  return (
    <section id="about" className="py-24 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div className="flex-1 max-w-xl">
          <p className="text-xs font-mono text-cli-muted uppercase tracking-widest mb-6">
            ◆ about
          </p>
          <p className="text-muted-foreground leading-7 max-w-xl">
            EA System is a cloud-based, multi-tenant School ERP platform that
            centralizes every aspect of school management into a single secure
            system. Designed for educational institutions of all sizes, it
            streamlines admissions, academics, attendance, examinations,
            finance, HR, transport, communication, and analytics through
            role-based dashboards and real-time collaboration. Its scalable
            architecture allows multiple schools to operate independently while
            sharing the same secure platform, making it suitable for growing
            school groups and educational organizations.
          </p>
        </div>

        <div className="flex-1 hidden md:block">
          <div className="relative border border-border rounded-xl p-6 bg-card/50">
            <div className="flex gap-8 items-stretch">
              <div className="flex flex-col gap-4 flex-1 justify-center">
                {(
                  [
                    { name: 'School A', accent: 'bg-cli-cyan' },
                    { name: 'School B', accent: 'bg-cli-emerald' },
                    { name: 'School C', accent: 'bg-cli-amber' },
                  ] as const
                ).map((school) => (
                  <div
                    key={school.name}
                    className={cn(
                      'border border-border rounded-lg p-4 bg-card text-sm font-mono flex items-center gap-3'
                    )}
                  >
                    <span
                      className={cn(
                        'block w-1 self-stretch rounded-full shrink-0',
                        school.accent
                      )}
                    />
                    <span>{school.name}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center">
                <div className="flex flex-col gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="block w-6 h-px bg-cli-muted/30" />
                  ))}
                </div>
              </div>

              <div className="flex items-center flex-1">
                <div className="border border-border rounded-lg p-6 bg-card text-sm font-mono text-center w-full">
                  <p className="text-foreground font-semibold">EA System</p>
                  <p className="text-cli-muted text-xs mt-1">Platform</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
