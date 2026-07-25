import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { Technology } from '@/components/landing/technology';
import { BrandMessages } from '@/components/landing/brand-messages';
import { About } from '@/components/landing/about';
import { BrandPositioning } from '@/components/landing/brand-positioning';
import { Security } from '@/components/landing/security';
import { Pricing } from '@/components/landing/pricing';
import { Testimonials } from '@/components/landing/testimonials';
import { Faq } from '@/components/landing/faq';
import { FinalCta } from '@/components/landing/final-cta';

export default function MarketingPage() {
  return (
    <>
      <Hero />
      <Features />
      <Technology />
      <BrandMessages />
      <About />
      <Security />
      <Pricing />
      <Testimonials />
      <Faq />
      <BrandPositioning />
      <FinalCta />
    </>
  );
}
