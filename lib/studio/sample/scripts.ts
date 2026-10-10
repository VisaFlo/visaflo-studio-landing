import { TOPICS } from "@/lib/studio/content"
import type { Script } from "@/lib/studio/sample/script"

// One fixed script per Studio topic, reused for everyone who picks it. These
// are the landing-page sample scripts (facts checked against canada.ca on
// 2026-09-29), so a consultant's sample matches what the site shows. The
// voice reads tts_text ("I-R-C-C" so the letters are spoken); captions show
// caption_text.
export const TOPIC_SCRIPTS: Record<string, Script> = {
  "express-entry": {
    headline: "CEC draw: 2,000 invitations, CRS 518",
    published: "2026-09-29",
    lines: [
      { tts_text: "[confident] New Express Entry draw.", caption_text: "New Express Entry draw." },
      {
        tts_text: "I-R-C-C just invited 2,000 Canadian Experience Class candidates, and the cut-off dropped again, to 518.",
        caption_text: "IRCC just invited 2,000 Canadian Experience Class candidates, and the cut-off dropped again, to 518.",
      },
      { tts_text: "That's three draws in a row going down: 521, 519, now 518.", caption_text: "That's three draws in a row going down: 521, 519, now 518." },
      {
        tts_text: "If your score is close, keep your profile up to date. Your invitation could come in the next round.",
        caption_text: "If your score is close, keep your profile up to date. Your invitation could come in the next round.",
      },
      { tts_text: "Follow along for next week's update.", caption_text: "Follow along for next week's update." },
    ],
    cards: [
      { line: 1, label: "Invitations", value: "2,000", sub: "Canadian Experience Class" },
      { line: 2, label: "CRS cut-off", value: "518", sub: "521 → 519 → 518" },
    ],
    sources: [
      {
        url: "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-rounds.html",
        title: "Express Entry rounds of invitations",
      },
    ],
    facts: [
      {
        claim: "CEC round: 2,000 invitations, CRS cut-off 518, after 521 and 519",
        source_url:
          "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-rounds.html",
      },
    ],
    estimated_seconds: 25,
  },

  "work-permits": {
    headline: "Study for up to 6 months without a study permit",
    published: "2026-09-29",
    lines: [
      { tts_text: "[warm] Good news if you're in Canada on a work permit.", caption_text: "Good news if you're in Canada on a work permit." },
      {
        tts_text: "I-R-C-C now lets you study for up to six months without a study permit.",
        caption_text: "IRCC now lets you study for up to 6 months without a study permit.",
      },
      {
        tts_text: "It's meant for workers like tradespeople and nurses who want to upgrade their skills while they keep working.",
        caption_text: "It's meant for workers like tradespeople and nurses who want to upgrade their skills while they keep working.",
      },
      {
        tts_text: "Full-time studies still need a study permit, and the measure runs until the end of 2027.",
        caption_text: "Full-time studies still need a study permit, and the measure runs until the end of 2027.",
      },
      { tts_text: "Follow along for next week's update.", caption_text: "Follow along for next week's update." },
    ],
    cards: [
      { line: 1, label: "Study without a permit", value: "6 months", sub: "Valid work permit holders" },
      { line: 3, label: "Runs until", value: "Dec 31, 2027", sub: "Full-time study still needs a permit" },
    ],
    sources: [
      {
        url: "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/public-policies/study-without-study-permit-2026-2.html",
        title: "Temporary public policy: work permit holders may study without a study permit",
      },
    ],
    facts: [
      {
        claim: "Valid work permit holders may take a program of 6 months or less without a study permit; policy expires December 31, 2027",
        source_url:
          "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/public-policies/study-without-study-permit-2026-2.html",
      },
    ],
    estimated_seconds: 25,
  },

  "study-permits": {
    headline: "Proof of funds rises to $23,448",
    published: "2026-09-29",
    lines: [
      {
        tts_text: "[serious] Applying for a study permit? The amount of money you need to show just went up.",
        caption_text: "Applying for a study permit? The amount of money you need to show just went up.",
      },
      {
        tts_text: "Since September 1st, a single student needs at least $23,448 for living costs, on top of tuition.",
        caption_text: "Since September 1, a single student needs at least $23,448 for living costs, on top of tuition.",
      },
      {
        tts_text: "If your bank statements show the old amount, check before you apply.",
        caption_text: "If your bank statements show the old amount, check before you apply.",
      },
      {
        tts_text: "Not sure where you stand? Talk to a licensed professional before you act.",
        caption_text: "Not sure where you stand? Talk to a licensed professional before you act.",
      },
      { tts_text: "Follow along for next week's update.", caption_text: "Follow along for next week's update." },
    ],
    cards: [
      { line: 1, label: "Proof of funds", value: "$23,448", sub: "Single student, living costs" },
      { line: 1, label: "In effect since", value: "Sept 1", sub: "On top of tuition" },
    ],
    sources: [
      {
        url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/get-documents.html",
        title: "Study permit: get the right documents (proof of financial support)",
      },
    ],
    facts: [
      {
        claim: "Minimum living-cost funds for a single study permit applicant outside Quebec: $23,448, since September 1",
        source_url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/get-documents.html",
      },
    ],
    estimated_seconds: 24,
  },

  family: {
    headline: "Parents and grandparents: intake paused, super visa stays open",
    published: "2026-09-29",
    lines: [
      { tts_text: "Planning to sponsor your parents or grandparents? Heads up.", caption_text: "Planning to sponsor your parents or grandparents? Heads up." },
      {
        tts_text: "Canada has paused new applications under the Parents and Grandparents Program. Existing files are still being processed.",
        caption_text: "Canada has paused new applications under the Parents and Grandparents Program. Existing files are still being processed.",
      },
      { tts_text: "[warm] But there's another option: the Super Visa.", caption_text: "But there's another option: the Super Visa." },
      {
        tts_text: "Your parents can stay up to five years at a time, and it's valid for up to ten years. Look into it now.",
        caption_text: "Your parents can stay up to 5 years at a time, and it's valid for up to 10 years. Look into it now.",
      },
      { tts_text: "Follow along for next week's update.", caption_text: "Follow along for next week's update." },
    ],
    cards: [
      { line: 1, label: "PGP intake", value: "Paused", sub: "Existing files still processed" },
      { line: 3, label: "Super visa stay", value: "5 years", sub: "Valid for up to 10 years" },
    ],
    sources: [
      {
        url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/family-sponsorship/sponsor-parents-grandparents.html",
        title: "Sponsor your parents and grandparents",
      },
      {
        url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/parent-grandparent-super-visa.html",
        title: "Super visa for parents and grandparents",
      },
    ],
    facts: [
      {
        claim: "PGP: not currently accepting applications; existing applications keep being processed",
        source_url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/family-sponsorship/sponsor-parents-grandparents.html",
      },
      {
        claim: "Super visa: valid up to 10 years, stays of up to 5 years per entry",
        source_url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/parent-grandparent-super-visa.html",
      },
    ],
    estimated_seconds: 25,
  },

  // Used when the consultant typed their own topic or the topic has no script.
  general: {
    headline: "Almost 250,000 PR applications are waiting in line",
    published: "2026-09-29",
    lines: [
      {
        tts_text: "[serious] Almost 250,000 PR applications are just waiting in line. That's the new government data.",
        caption_text: "Almost 250,000 PR applications are just waiting in line. That's the new government data.",
      },
      { tts_text: "Canada only has so many PR spots each year. The rest wait.", caption_text: "Canada only has so many PR spots each year. The rest wait." },
      {
        tts_text: "Family sponsorship: four in ten. Work-based PR: about one in five.",
        caption_text: "Family sponsorship: 4 in 10. Work-based PR: about 1 in 5.",
      },
      {
        tts_text: "On a work permit in Canada? Don't let it expire. Extensions take over a hundred days right now, so apply early.",
        caption_text: "On a work permit in Canada? Don't let it expire. Extensions take over 100 days right now, so apply early.",
      },
      {
        tts_text: "This fall, Canada sets next year's targets. Follow along for the update.",
        caption_text: "This fall, Canada sets next year's targets. Follow along for the update.",
      },
    ],
    cards: [
      { line: 0, label: "PR applications waiting", value: "~250,000", sub: "Latest government data" },
      { line: 2, label: "Family sponsorship", value: "4 in 10", sub: null },
      { line: 2, label: "Work-based PR", value: "1 in 5", sub: null },
      { line: 3, label: "Work permit extension", value: "100+ days", sub: "Apply early" },
    ],
    sources: [
      {
        url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html",
        title: "Check processing times",
      },
    ],
    facts: [
      {
        claim: "Work permit extension processing times exceed 100 days",
        source_url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html",
      },
    ],
    estimated_seconds: 28,
  },
}

export const DEFAULT_SCRIPT_ID = "general"

export function templateFor(topicId: string | undefined): Script {
  const known = TOPICS.some((t) => t.id === topicId) && topicId && TOPIC_SCRIPTS[topicId]
  return known || TOPIC_SCRIPTS[DEFAULT_SCRIPT_ID]
}

export function templateId(topicId: string | undefined): string {
  return TOPICS.some((t) => t.id === topicId) && topicId && TOPIC_SCRIPTS[topicId] ? topicId : DEFAULT_SCRIPT_ID
}
