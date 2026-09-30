import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Nav } from "@/components/landing/nav";
import { VideoMarquee } from "@/components/landing/video-marquee";
import { WaitlistProvider } from "@/components/landing/waitlist-provider";
import { WaitlistSection } from "@/components/landing/waitlist-section";

export default function Home() {
  return (
    <WaitlistProvider>
      <div className="min-h-screen bg-white leading-[normal] text-stone-950">
        <Nav />
        <Hero />
        <VideoMarquee />
        <HowItWorks />
        <WaitlistSection />
        <Footer />
      </div>
    </WaitlistProvider>
  );
}
