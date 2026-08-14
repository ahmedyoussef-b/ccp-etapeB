import { Navbar } from "@/components/homepage/navbar";
import { Hero } from "@/components/homepage/hero";
import { Features } from "@/components/homepage/features";
import { Stats } from "@/components/homepage/stats";
import { Pricing } from "@/components/homepage/pricing";
import { CTA } from "@/components/homepage/cta";
import { Footer } from "@/components/homepage/footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <Stats />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
