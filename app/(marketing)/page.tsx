import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import Pricing from "@/components/landing/Pricing";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <footer className="bg-muted/40 border-t border-border py-10">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} AI Resume Reviewer. All rights reserved.
        </div>
      </footer>
    </>
  );
}
