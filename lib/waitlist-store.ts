import { appendFile, mkdir, readFile } from "node:fs/promises"
import path from "node:path"

import type { WaitlistEntry } from "@/lib/waitlist"

// File-backed store: one JSON object per line. It needs a writable, persistent
// disk, so it works for local development and a long-running Node server but
// NOT on serverless hosts (read-only / ephemeral filesystem). Swap the body of
// `saveWaitlistEntry` for a database, Resend, Loops or a Google Sheet before
// deploying there.
const DATA_FILE = path.join(process.cwd(), ".data", "waitlist.jsonl")

// Serialises writes so two concurrent signups can't both pass the dedupe check.
let queue: Promise<unknown> = Promise.resolve()

async function readEmails(): Promise<Set<string>> {
  let contents: string
  try {
    contents = await readFile(DATA_FILE, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Set()
    throw error
  }
  const emails = new Set<string>()
  for (const line of contents.split("\n")) {
    if (!line.trim()) continue
    emails.add((JSON.parse(line) as WaitlistEntry).email)
  }
  return emails
}

async function write(entry: WaitlistEntry): Promise<{ duplicate: boolean }> {
  await mkdir(path.dirname(DATA_FILE), { recursive: true })
  const emails = await readEmails()
  if (emails.has(entry.email)) return { duplicate: true }
  const record = { ...entry, createdAt: new Date().toISOString() }
  await appendFile(DATA_FILE, `${JSON.stringify(record)}\n`, "utf8")
  return { duplicate: false }
}

export function saveWaitlistEntry(entry: WaitlistEntry): Promise<{ duplicate: boolean }> {
  const result = queue.then(() => write(entry))
  queue = result.catch(() => undefined)
  return result
}
