const steps = [
  {
    step: "01",
    title: "Paste Your Resume",
    description:
      "Copy and paste your resume text into the editor. No formatting required — plain text works perfectly.",
  },
  {
    step: "02",
    title: "Get AI Feedback",
    description:
      "Our AI scores your resume against the job description in seconds, surfacing strengths, gaps, and missing keywords.",
  },
  {
    step: "03",
    title: "Land the Job",
    description:
      "Apply the targeted improvements, resubmit, and track your progress over time with your personal review history.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="bg-muted/40 py-24"
    >
      <div className="container mx-auto px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Three simple steps between you and a stronger application.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((item, index) => (
            <div key={item.step} className="relative flex flex-col items-center text-center">
              {/* Connector line between steps (hidden on last) */}
              {index < steps.length - 1 && (
                <div
                  className="absolute left-1/2 top-8 hidden h-px w-full -translate-y-1/2 bg-border md:block"
                  aria-hidden="true"
                />
              )}

              <div className="relative z-10 flex size-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground shadow-md">
                {item.step}
              </div>
              <h3 className="mt-6 text-xl font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
