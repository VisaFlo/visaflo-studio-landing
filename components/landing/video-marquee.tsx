import { SAMPLES } from "@/components/landing/samples"
import { VideoCard } from "@/components/landing/video-card"

// One half of the track must be wider than the viewport for the -50% loop to
// be seamless. Two rounds of the samples cover screens up to ~3600px wide.
const ROUNDS = 2
const HALF = Array.from({ length: ROUNDS }, () => SAMPLES).flat()
const SECONDS_PER_CARD = 10
const STAGGER_SECONDS = 6

function VideoMarquee() {
  return (
    <section
      id="samples"
      className="scroll-mt-20 overflow-hidden pt-16 pb-10 md:pt-28 lg:pt-32 md:pb-12 motion-reduce:overflow-x-auto"
    >
      <div className="mx-auto mb-4 max-w-[1360px] px-(--page-pad)">
        <h2 className="font-mono text-[11px] tracking-[0.1em] text-stone-600 uppercase">
          See what you could post
        </h2>
      </div>
      <div
        // On hover the track stops and every card except the hovered one fades.
        className="flex w-max animate-marquee hover:[animation-play-state:paused] [&:hover>*:not(:hover)]:opacity-30 motion-reduce:animate-none"
        style={{ animationDuration: `${HALF.length * SECONDS_PER_CARD}s` }}
      >
        {[...HALF, ...HALF].map((sample, i) => (
          <VideoCard
            key={i}
            sample={sample}
            startAt={(Math.floor(i / SAMPLES.length) % ROUNDS) * STAGGER_SECONDS}
            hidden={i >= SAMPLES.length}
          />
        ))}
      </div>
    </section>
  )
}

export { VideoMarquee }
