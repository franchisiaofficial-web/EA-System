const phrases = [
  'Built for Modern Education',
  'One Platform. Every School.',
  'Everything Connected.',
  'Simplify School Management.',
  'Manage Smarter. Educate Better.',
  'Cloud-Native School ERP.',
  'Secure. Scalable. Reliable.',
  'Real-Time Insights. Better Decisions.',
  'From Admissions to Graduation.',
];

export function BrandMessages() {
  const repeated = [...phrases, ...phrases];

  return (
    <section className="py-8">
      <div className="overflow-hidden whitespace-nowrap border-y border-border py-4">
        <div
          className="marquee-track inline-flex"
          style={{ animation: 'marquee 30s linear infinite' }}
        >
          {repeated.map((phrase, i) => (
            <span
              key={i}
              className="text-sm font-mono text-muted-foreground mx-2"
            >
              {phrase}
              {i < repeated.length - 1 && (
                <span className="text-muted-foreground mx-2">·</span>
              )}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
