import Link from "next/link";

const tiers = [
  {
    name: "Starter",
    price: "Free",
    description: "Perfect for exploring and getting started.",
    limit: "3 reviews / day",
    features: [
      "3 AI resume reviews per day",
      "Full keyword match analysis",
      "Score + strengths + improvements",
      "Review history (last 30 days)",
    ],
    cta: "Get Started Free",
    href: "/sign-up",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/ month",
    description: "For serious job seekers applying at scale.",
    limit: "Unlimited reviews",
    features: [
      "Unlimited AI resume reviews",
      "Full keyword match analysis",
      "Score + strengths + improvements",
      "Full review history",
      "Priority AI processing",
    ],
    cta: "Upgrade to Pro",
    href: "/sign-up",
    highlighted: true,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="bg-background py-24">
      <div className="container mx-auto px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start for free. Upgrade when you need more.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:mx-auto lg:max-w-3xl">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`flex flex-col rounded-2xl border p-8 shadow-sm ${
                tier.highlighted
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground"
              }`}
            >
              <div className="mb-6">
                <h3
                  className={`text-xl font-bold ${
                    tier.highlighted ? "text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {tier.name}
                </h3>
                <p
                  className={`mt-1 text-sm ${
                    tier.highlighted
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  }`}
                >
                  {tier.description}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">{tier.price}</span>
                  {tier.period && (
                    <span
                      className={`text-sm font-medium ${
                        tier.highlighted
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {tier.period}
                    </span>
                  )}
                </div>
                <p
                  className={`mt-2 text-sm font-medium ${
                    tier.highlighted
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground"
                  }`}
                >
                  {tier.limit}
                </p>
              </div>

              <ul className="mb-8 flex flex-col gap-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`mt-0.5 size-4 shrink-0 ${
                        tier.highlighted
                          ? "text-primary-foreground"
                          : "text-primary"
                      }`}
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span
                      className={`text-sm ${
                        tier.highlighted
                          ? "text-primary-foreground/90"
                          : "text-muted-foreground"
                      }`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                <Link
                  href={tier.href}
                  className={`block w-full rounded-lg px-6 py-3 text-center text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    tier.highlighted
                      ? "bg-white text-primary hover:bg-white/90 focus-visible:outline-white"
                      : "bg-primary text-primary-foreground hover:bg-primary/80 focus-visible:outline-primary"
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
