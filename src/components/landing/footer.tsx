const columnHeading =
  'text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4';
const linkClass =
  'block text-sm text-muted-foreground hover:text-foreground transition-colors';

export function Footer() {
  return (
    <footer className="border-t border-border py-16 px-4 bg-card">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div>
            <p className="font-mono text-lg text-foreground">&rsaquo; EA System</p>
            <p className="text-xs text-muted-foreground/60 mt-1">@ 2026</p>
          </div>

          <div>
            <h4 className={columnHeading}>Product</h4>
            <a href="#" className={linkClass}>
              Features
            </a>
            <a href="#" className={linkClass}>
              Pricing
            </a>
            <a href="#" className={linkClass}>
              Security
            </a>
            <a href="#" className={linkClass}>
              Changelog
            </a>
          </div>

          <div>
            <h4 className={columnHeading}>Company</h4>
            <a href="#" className={linkClass}>
              About
            </a>
            <a href="#" className={linkClass}>
              Blog
            </a>
            <a href="#" className={linkClass}>
              Careers
            </a>
            <a href="#" className={linkClass}>
              Contact
            </a>
          </div>

          <div>
            <h4 className={columnHeading}>Resources</h4>
            <a href="#" className={linkClass}>
              Documentation
            </a>
            <a href="#" className={linkClass}>
              API Reference
            </a>
            <a href="#" className={linkClass}>
              Help Center
            </a>
            <a href="#" className={linkClass}>
              Community
            </a>
          </div>

          <div>
            <h4 className={columnHeading}>Legal</h4>
            <a href="#" className={linkClass}>
              Privacy Policy
            </a>
            <a href="#" className={linkClass}>
              Terms of Service
            </a>
            <a href="#" className={linkClass}>
              Cookie Policy
            </a>
            <a href="#" className={linkClass}>
              GDPR
            </a>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-6 flex items-center justify-between">
          <p className="text-xs font-mono text-muted-foreground/70">
            &copy; 2026 &middot; EA System &middot; all systems operational
          </p>
          <span className="text-xs font-mono text-cli-emerald flex items-center">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cli-emerald animate-pulse mr-1.5" />
            operational
          </span>
        </div>
      </div>
    </footer>
  );
}
