// Copy the capture flow reads from. The script is only a voice sample: it is
// never posted, so it sticks to advice that holds for any client.
export function scriptLines(name: string, firm: string): string[] {
  const intro = name && firm ? `Hi, I'm ${name} from ${firm}.` : name ? `Hi, I'm ${name}.` : "Hi there."
  return [
    intro,
    "Immigration rules in Canada change almost every week,",
    "and most people only hear about it when it's too late.",
    "So here are three things I tell every client before they apply.",
    "First, check that your passport stays valid for your whole stay.",
    "Many permits are only issued up to the date your passport expires.",
    "Second, keep a copy of every form and document you send.",
    "If IRCC asks a question later, you will want to see exactly what you submitted.",
    "Third, watch your email and your online account.",
    "When IRCC asks for more documents, there is a deadline, and missing it can end your application.",
    "None of this is complicated, but it is easy to miss when you are busy.",
    "If you are not sure where your file stands, talk to a licensed professional before you act.",
    "I post short updates like this every week, so follow along for the next one.",
  ]
}

// Seconds the teleprompter spends on a line: an unhurried 150 words a minute.
export function lineSeconds(line: string): number {
  return Math.max(2.5, line.split(/\s+/).length * 0.4)
}

export const TARGET_SECONDS = 90
export const MAX_SECONDS = 180

export type Topic = { id: string; title: string; detail: string }

// Broad areas rather than headlines: we pick the week's freshest update in
// the chosen area when we make the sample.
export const TOPICS: Topic[] = [
  { id: "express-entry", title: "The latest Express Entry draw", detail: "Express Entry" },
  { id: "study-permits", title: "What changed for study permits", detail: "Study permits" },
  { id: "work-permits", title: "What changed for work permits", detail: "Work permits" },
  { id: "family", title: "Family sponsorship updates", detail: "Family" },
]

export const OWN_TOPIC_ID = "own"

export const CONSENT_TEXT =
  "I agree VisaFlo can use my face and voice to make videos that I approve before they are posted."
