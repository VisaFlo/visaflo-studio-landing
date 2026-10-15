"use client"

import { Focus, Megaphone, ScanFace, Sun, User, VolumeX, type LucideIcon } from "lucide-react"

import { FlowTitle, MonoLabel, PrimaryButton } from "@/components/studio/ui"

// What a good portrait photo and a good portrait video look like, shown
// before each capture: the three tips on one page, then the camera.

export type Tip = { icon: LucideIcon; title: string; text: string }

export type Guide = {
  label: string
  heading: string
  lead: string
  tips: Tip[]
}

export const PHOTO_GUIDE: Guide = {
  label: "Photo guidelines",
  heading: "A great photo makes a great video",
  lead: "Here's what to look for before you take yours.",
  tips: [
    {
      icon: ScanFace,
      title: "Looking straight at the camera",
      text: "Both eyes visible, chin level. No sunglasses, no hat brim.",
    },
    {
      icon: Sun,
      title: "Good, even lighting",
      text: "Your face should be bright and easy to see. Face a window or a lamp, and skip harsh shadows or a bright light behind you.",
    },
    {
      icon: User,
      title: "Just you in the frame",
      text: "No other people, no pets. Close enough that the details of your face are clear.",
    },
  ],
}

export const VIDEO_GUIDE: Guide = {
  label: "Video guidelines",
  heading: "Your video teaches us how you talk",
  lead: "About 30 seconds of you reading a short script. Here's how to make it count.",
  tips: [
    {
      icon: Megaphone,
      title: "Speak with energy",
      text: "Talk like you're explaining it to a client: warm, clear, a little upbeat. Move the way you normally do.",
    },
    {
      icon: Focus,
      title: "Stay centered in frame",
      text: "Keep your face in the oval. Don't sway or lean out of the frame.",
    },
    {
      icon: VolumeX,
      title: "Quiet room, steady camera",
      text: "We learn your voice from this clip, so no music or other voices. Rest your phone or laptop so it doesn't move.",
    },
  ],
}

export function GuideStep({ guide, onDone }: { guide: Guide; onDone: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-grow flex-col justify-center gap-8 px-(--page-pad) py-10 sm:py-14">
      <div className="flex flex-col gap-3">
        <MonoLabel className="text-[#4d5a48]">{guide.label}</MonoLabel>
        <FlowTitle>{guide.heading}</FlowTitle>
        <p className="m-0 text-[16px] leading-[1.5] text-stone-600">{guide.lead}</p>
      </div>
      <ul className="m-0 flex list-none flex-col border-t border-stone-200 p-0">
        {guide.tips.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-4 border-b border-stone-200 py-5">
            <Icon className="mt-0.5 size-6 shrink-0 text-stone-700" strokeWidth={1.6} aria-hidden />
            <div className="flex flex-col gap-1">
              <h2 className="m-0 text-[17px] font-medium">{title}</h2>
              <p className="m-0 text-[15px] leading-[1.5] text-stone-600">{text}</p>
            </div>
          </li>
        ))}
      </ul>
      <PrimaryButton type="button" onClick={onDone} className="self-start px-10">
        I&apos;m ready
      </PrimaryButton>
    </main>
  )
}
