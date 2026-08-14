"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import Link from "next/link";

const plans = [
  {
    name: "Starter",
    description: "For small teams getting started",
    price: "$0",
    period: "/month",
    cta: "Start free",
    featured: false,
    href: "/login",
    features: [
      "5 active workflows",
      "100 runs / month",
      "Community support",
      "1 team member",
    ],
  },
  {
    name: "Pro",
    description: "For growing teams that need more power",
    price: "$49",
    period: "/month",
    cta: "Start trial",
    featured: true,
    href: "/login",
    features: [
      "Unlimited workflows",
      "10,000 runs / month",
      "Priority support",
      "Up to 10 team members",
      "Advanced observability",
    ],
  },
  {
    name: "Enterprise",
    description: "For organizations with advanced needs",
    price: "Custom",
    period: "",
    cta: "Contact sales",
    featured: false,
    href: "/contact",
    features: [
      "Unlimited everything",
      "SSO / SAML",
      "Dedicated success manager",
      "SLA guarantee",
      "Custom integrations",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 sm:py-32 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free and upgrade as you grow. No hidden fees.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border bg-card p-8 shadow-sm transition-all hover:shadow-md ${
                plan.featured ? "border-primary ring-2 ring-primary/20" : "border-border"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge>Most popular</Badge>
                </div>
              )}
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                <div className="mt-4 flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold tracking-tight text-foreground">{plan.price}</span>
                  {plan.period && (
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  )}
                </div>
                <Link href={plan.href}>
                  <Button className="mt-6 w-full" variant={plan.featured ? "default" : "outline"}>
                    {plan.cta}
                  </Button>
                </Link>
              </div>
              <Separator className="my-6" />
              <ul className="space-y-3 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 text-primary"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
