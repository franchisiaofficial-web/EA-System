import { Button } from '@/components/ui/button';

export function FinalCta() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-4xl font-bold font-mono">
          One Platform. Every Department. Every School.
        </h2>
        <div className="flex flex-row gap-4 justify-center mt-8">
          <Button className="bg-primary text-primary-foreground hover:bg-cli-blue/90">
            Start Free Trial
          </Button>
          <Button variant="outline">Book a Live Demo</Button>
        </div>
      </div>
    </section>
  );
}
