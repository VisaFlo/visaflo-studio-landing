import { Footer } from "@/components/landing/footer"
import { Hero } from "@/components/landing/hero"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Nav } from "@/components/landing/nav"
import { Top50Banner } from "@/components/landing/top50-banner"
import { VideoMarquee } from "@/components/landing/video-marquee"
import { WaitlistProvider } from "@/components/landing/waitlist-provider"
import { WaitlistSection } from "@/components/landing/waitlist-section"

// The whole landing page. "/" renders it as is; "/chart" renders it with the
// Top 50 dialog already open so the chart has a shareable URL of its own.
function LandingPage({ chartOpen = false }: { chartOpen?: boolean }) {
  return (
    <WaitlistProvider>
      <div className="min-h-screen bg-white leading-[normal] text-stone-950">
        <Top50Banner defaultOpen={chartOpen} />
        <Nav />
        <Hero />
        <VideoMarquee />
        <HowItWorks />
        <WaitlistSection />
        <Footer />
      </div>
    </WaitlistProvider>
  )
}

export { LandingPage }
