"use client";

export function Stats() {
  const items = [
    { label: "Uptime", value: "99.99%" },
    { label: "Integrations", value: "200+" },
    { label: "Teams", value: "12k+" },
    { label: "Runs per month", value: "800M+" },
  ];

  return (
    <section className="border-y border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="text-center">
              <div className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {item.value}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
