import Link from "next/link";

export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-primary to-primary/90 text-primary-foreground">
      <div className="container mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Land the job with AI-powered resume feedback
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-primary-foreground/80">
          Paste your resume and a job description. In seconds, get a score,
          keyword analysis, and targeted suggestions to beat the ATS and impress
          hiring managers.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="rounded-lg bg-white px-8 py-3 text-base font-semibold text-primary shadow hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
          >
            Get Started Free
          </Link>
          <Link
            href="#how-it-works"
            className="text-base font-semibold text-primary-foreground/80 hover:text-primary-foreground transition-colors"
          >
            See how it works →
          </Link>
        </div>
      </div>
    </section>
  );
}
