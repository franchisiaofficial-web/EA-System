const testimonials = [
  {
    quote:
      'EA System transformed how we manage our five campuses. The multi-tenant architecture keeps everything organized while giving us a unified view across all schools.',
    name: 'Dr. Sarah Chen',
    role: 'Superintendent, Horizon Academies',
  },
  {
    quote:
      'The role-based dashboards mean our teachers only see what they need, our finance team has their tools, and parents love the communication portal. It just works.',
    name: 'Marcus Rivera',
    role: 'IT Director, Riverside School District',
  },
  {
    quote:
      'We evaluated six platforms before choosing EA System. The real-time analytics alone saved us 20 hours per week in manual reporting. The onboarding was smoother than expected.',
    name: 'Priya Patel',
    role: 'Principal, Greenwood International',
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold font-sans text-center mb-12">
          Trusted by Schools
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="border border-border rounded-xl p-6 bg-card"
            >
              <p className="italic text-muted-foreground leading-relaxed">
                {t.quote}
              </p>
              <div className="border-t border-border w-12 my-4" />
              <div>
                <p className="text-sm font-bold">{t.name}</p>
                <p className="text-sm text-cli-muted">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
