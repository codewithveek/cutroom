import type React from "react";
import { HeroSection } from "@/features/hero/hero-section";
import { HowItWorks } from "@/features/how-it-works/how-it-works";
import { LaunchVideoSection } from "@/features/launch-video/launch-video-section";
import { FeatureCards } from "@/features/product-features/feature-cards";
import { RunItYourself } from "@/features/run-it-yourself/run-it-yourself";
import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav } from "@/features/site/site-nav";
import { StylesGallery } from "@/features/styles-gallery/styles-gallery";
import { WaitlistSection } from "@/features/waitlist/waitlist-section";

export default function LandingPage(): React.ReactElement {
  return (
    <>
      <SiteNav />
      <main>
        <HeroSection />
        <LaunchVideoSection />
        <FeatureCards />
        <HowItWorks />
        <StylesGallery />
        <RunItYourself />
        <WaitlistSection />
      </main>
      <SiteFooter />
    </>
  );
}
