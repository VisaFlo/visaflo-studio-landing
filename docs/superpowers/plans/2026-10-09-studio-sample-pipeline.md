# Studio Sample Video Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From `/admin`, turn a submitted face-and-voice recording into a 25-second vertical news short in the person's own face and voice (captions, fact cards, music, SFX), one restartable stage at a time.

**Architecture:** Next.js API routes under `/api/admin/sample/*` run each stage with the admin's own Firebase ID token against the Storage REST API (no service account); every artefact lives in `studio/{uid}/{submissionId}/sample/`. External jobs (fal, Higgsfield, Remotion Lambda) are submitted by a `run` route and finished by a `poll` route the admin page calls every 5 s. Pure logic (stage state machine, word timing, script validation, caption grouping) lives in small modules with Vitest tests; provider calls are thin `fetch` wrappers tested against a mocked `fetch`.

**Tech Stack:** Next.js 16 (App Router, Node runtime), TypeScript, Vitest, `ffmpeg-static`, OpenAI Responses API (`gpt-6-sol` + `web_search`), ElevenLabs REST, fal.ai queue REST, Higgsfield REST, Remotion 4 (+ Lambda), Firebase Storage REST.

**Spec:** `docs/superpowers/specs/2026-10-09-studio-sample-pipeline-design.md`

## Global Constraints

- Only `bkim@vflo.app` with a verified email reaches any `/api/admin/*` route (`isStudioAdmin`, `emailVerified`); storage rules enforce the same email.
- No service account: all bucket reads and writes use the admin's ID token through `https://firebasestorage.googleapis.com/v0/b/devdashboard-c9159-ca/o`.
- Output video: 1080×1920, 30 fps, speech 22–28 s; any speech over 30 s fails the Voice stage before video spend.
- Script: 65–85 words; "I-R-C-C" in `tts_text`, "IRCC" in `caption_text`; every source URL on `canada.ca`; card `value` ≤ 12 chars, `label` ≤ 28, `sub` ≤ 40.
- Model ids: `gpt-6-sol` (verify with `GET https://api.openai.com/v1/models` on first run), ElevenLabs `eleven_v4` → `eleven_v3` → `eleven_multilingual_v2` fallback order, `music_v2_5`, `eleven_text_to_sound_v2`, fal `fal-ai/sync-lipsync/v2/pro` and `fal-ai/bytedance/omnihuman/v1.5`, Higgsfield `bytedance/seedance-2.5/reference-to-video`.
- Prices written to `status.json` come from `lib/studio/sample/costs.ts` only.
- Code style: match the repo — short file-top comments explaining *why*, no semicolons, double quotes, 2-space indent, `@/` imports.
- Route consolidation vs the spec: stages run through `POST /api/admin/sample/run/[stage]`, async jobs finish through `GET /api/admin/sample/poll`, status through `GET /api/admin/sample/status`, options through `PUT /api/admin/sample/options`, script edits through `PUT /api/admin/sample/script`. Same behaviour, fewer files.
- `/sample` is already an Instantly redirect in `next.config.ts`; the phase-2 review page must live at `/watch/[token]`, not `/sample/...`.

## Review Focus

1. A recording shorter than 75 s (upload path, or a person who stopped early): Prep must clamp the voice sample and frame times to the real duration instead of producing empty files — tested in Task 5.
2. ElevenLabs `alignment` word count differing from `caption_text` word count (tags, "I-R-C-C", normalisation): words must still land on the right line with monotonic times — tested in Task 7.
3. Re-running Script after Voice is done: Voice/Video/Audio/Render must show `stale`, and Video must refuse to run until Voice is redone — tested in Task 2.
4. Provider job that never completes: the poll route must flip the stage to `failed` with "timed out" after the limit, never spin forever — tested in Task 8.
5. Storage rules not yet published (401/403 from the bucket): routes must return the same "Publish the latest storage.rules" message the list route uses, not a generic 500 — tested in Task 3.

---

## File structure

```
lib/studio/storage.ts                 bucket constants, StorageError, storageGet/storageJson/storageUpload/storageMeta/listObjects/mediaUrl
lib/studio/admin-auth.ts              requireAdmin(request) → { user, token } | Response
lib/studio/submissions.ts             (modified) uses lib/studio/storage.ts
app/api/admin/submissions/route.ts    (modified) uses requireAdmin
lib/studio/sample/status.ts           SampleStatus types, STAGES, DEPENDS, blockers, startStage/finishStage/failStage, timedOut
lib/studio/sample/costs.ts            PRICES, videoCost, audioCost, ttsCost
lib/studio/sample/context.ts          parseSampleId, readStatus/writeStatus, sampleFile paths, storageFailure
lib/studio/sample/ffmpeg.ts           probeSeconds, extractVoiceSample, extractFrame, cutClip, tmpDir, downloadTo
lib/studio/sample/prompts.ts          scene/omnihuman/music/sfx prompt text and presets
lib/studio/sample/script.ts           Script types, JSON schema, system/user prompts, validateScript, generateScript
lib/studio/sample/words.ts            wordsFromAlignment
lib/studio/sample/elevenlabs.ts       createVoice, synthesize (with timestamps + model fallback), composeMusic, soundEffect
lib/studio/sample/fal.ts              submitFal, pollFal
lib/studio/sample/higgsfield.ts       submitSeedance, pollHiggsfield
lib/studio/sample/render.ts           renderProps, startRender (Lambda or local), pollRender
lib/studio/sample/stages.ts           STAGE_WORK registry: prep, script, voice, video, audio, render + pollJob
lib/studio/sample/client.ts           browser helpers for the admin panel
app/api/admin/sample/status/route.ts  GET
app/api/admin/sample/options/route.ts PUT
app/api/admin/sample/script/route.ts  PUT
app/api/admin/sample/run/[stage]/route.ts  POST
app/api/admin/sample/poll/route.ts    GET
remotion/index.ts, Root.tsx, Sample.tsx, Captions.tsx, Cards.tsx, captions.ts, types.ts, fixtures/
remotion.config.ts
scripts/render-sample.ts              local render fallback (reads render-props.json URL, uploads final.mp4)
scripts/make-fixtures.sh              synthesises fixture media with ffmpeg
components/studio/sample-panel.tsx    Make sample panel (options, stages, previews)
components/studio/script-editor.tsx   lines/cards/sources editor
components/studio/admin.tsx           (modified) mounts SamplePanel in SubmissionDetail
docs/studio-capture/storage.rules     (modified) admin write under studio/**
docs/studio-capture/rules-test.mjs    (modified) admin write cases
docs/studio-capture/README.md         (modified) sample pipeline section
vitest.config.ts, package.json scripts/deps, next.config.ts tracing, .env.local keys
```

---

### Task 1: Vitest, shared storage module, admin route guard

**Files:**
- Create: `vitest.config.ts`, `lib/studio/storage.ts`, `lib/studio/admin-auth.ts`, `lib/studio/storage.test.ts`
- Modify: `package.json`, `lib/studio/submissions.ts`, `app/api/admin/submissions/route.ts`

**Interfaces:**
- Produces:
  - `BUCKET`, `PROJECT_ID`, `storageBase(): string`, `class StorageError extends Error { status: number }`
  - `storageGet(token, path): Promise<Response>` — `path` is everything after `/o`, e.g. `/${encodeURIComponent(name)}?alt=media` or `?prefix=…`
  - `storageJson<T>(token, objectName): Promise<T>` — downloads and parses `?alt=media`
  - `storageMeta(token, objectName): Promise<ObjectMeta>` — `{ name, size?, contentType?, timeCreated?, downloadTokens?, metadata? }`
  - `storageUpload(token, objectName, body: Uint8Array | string, contentType, customMetadata?): Promise<ObjectMeta>` — multipart upload exactly like the Firebase SDK; response carries `downloadTokens`
  - `listObjects(token, prefix): Promise<{ prefixes: string[]; items: string[] }>`
  - `mediaUrl(objectName, downloadToken): string` — public `?alt=media&token=` URL
  - `buildMultipart(objectName, body, contentType, customMetadata?): { contentType: string; body: Uint8Array }` (exported for the test)
  - `requireAdmin(request): Promise<{ user: VerifiedUser; token: string } | Response>`

- [ ] **Step 1: Install Vitest and add scripts**

```bash
npm i -D vitest tsx
```

In `package.json` scripts add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: { environment: "node", include: ["lib/**/*.test.ts", "remotion/**/*.test.ts"] },
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
})
```

- [ ] **Step 2: Write the failing storage test**

`lib/studio/storage.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { buildMultipart, mediaUrl } from "@/lib/studio/storage"

describe("mediaUrl", () => {
  it("encodes the object name and carries the token", () => {
    expect(mediaUrl("studio/u1/s1/sample/speech.mp3", "abc")).toBe(
      "https://firebasestorage.googleapis.com/v0/b/devdashboard-c9159-ca/o/studio%2Fu1%2Fs1%2Fsample%2Fspeech.mp3?alt=media&token=abc",
    )
  })
})

describe("buildMultipart", () => {
  it("writes the metadata part then the file part, Firebase SDK style", () => {
    const { contentType, body } = buildMultipart("studio/u/s/sample/a.json", '{"x":1}', "application/json", { k: "v" })
    const text = new TextDecoder().decode(body)
    const boundary = contentType.replace("multipart/related; boundary=", "")
    expect(boundary.length).toBeGreaterThan(8)
    expect(text.startsWith(`--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n`)).toBe(true)
    expect(text).toContain('"name":"studio/u/s/sample/a.json"')
    expect(text).toContain('"contentType":"application/json"')
    expect(text).toContain('"metadata":{"k":"v"}')
    expect(text).toContain(`\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n{"x":1}\r\n--${boundary}--`)
  })

  it("keeps binary bodies intact", () => {
    const bytes = new Uint8Array([0, 255, 10, 13, 128])
    const { body } = buildMultipart("f.bin", bytes, "application/octet-stream")
    const text = new TextDecoder("latin1").decode(body)
    const idx = text.indexOf("\r\n\r\n", text.indexOf("application/octet-stream")) + 4
    expect(Array.from(body.slice(idx, idx + 5))).toEqual([0, 255, 10, 13, 128])
  })
})
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npm test -- lib/studio/storage.test.ts`
Expected: FAIL — cannot resolve `@/lib/studio/storage`.

- [ ] **Step 4: Create `lib/studio/storage.ts`**

```ts
// Firebase Storage over REST with the caller's own ID token: the storage
// rules decide what each token may read or write, so no service account is
// needed on Vercel. Shared by the submission list and the sample pipeline.
export const BUCKET = "devdashboard-c9159-ca"
export const PROJECT_ID = "devdashboard-c9159"

// Local QA: the same Storage emulator the browser uploads to (see
// docs/studio-capture/README.md).
export function storageBase(): string {
  const host =
    process.env.NODE_ENV !== "production"
      ? (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST ?? process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST)
      : undefined
  return host ? `http://${host}:9199` : "https://firebasestorage.googleapis.com"
}

export class StorageError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`Storage responded ${status}: ${detail.slice(0, 300)}`)
  }
}

export type ObjectMeta = {
  name: string
  size?: string
  contentType?: string
  timeCreated?: string
  downloadTokens?: string
  metadata?: Record<string, string>
}

const objects = () => `${storageBase()}/v0/b/${BUCKET}/o`

export async function storageGet(token: string, path: string): Promise<Response> {
  const response = await fetch(`${objects()}${path}`, {
    headers: { Authorization: `Firebase ${token}` },
    cache: "no-store",
  })
  if (!response.ok) throw new StorageError(response.status, await response.text())
  return response
}

export async function storageJson<T>(token: string, objectName: string): Promise<T> {
  return (await storageGet(token, `/${encodeURIComponent(objectName)}?alt=media`)).json() as Promise<T>
}

export async function storageMeta(token: string, objectName: string): Promise<ObjectMeta> {
  return (await storageGet(token, `/${encodeURIComponent(objectName)}`)).json() as Promise<ObjectMeta>
}

export async function storageBytes(token: string, objectName: string): Promise<Uint8Array> {
  return new Uint8Array(await (await storageGet(token, `/${encodeURIComponent(objectName)}?alt=media`)).arrayBuffer())
}

// The same multipart body the Firebase SDK sends for uploadBytes, so the
// bucket treats it like a browser upload and mints a download token.
export function buildMultipart(
  objectName: string,
  body: Uint8Array | string,
  contentType: string,
  customMetadata?: Record<string, string>,
): { contentType: string; body: Uint8Array } {
  const boundary = `b${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  const meta = JSON.stringify({ name: objectName, contentType, ...(customMetadata ? { metadata: customMetadata } : {}) })
  const head = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
  )
  const file = typeof body === "string" ? new TextEncoder().encode(body) : body
  const tail = new TextEncoder().encode(`\r\n--${boundary}--`)
  const out = new Uint8Array(head.length + file.length + tail.length)
  out.set(head, 0)
  out.set(file, head.length)
  out.set(tail, head.length + file.length)
  return { contentType: `multipart/related; boundary=${boundary}`, body: out }
}

export async function storageUpload(
  token: string,
  objectName: string,
  body: Uint8Array | string,
  contentType: string,
  customMetadata?: Record<string, string>,
): Promise<ObjectMeta> {
  const part = buildMultipart(objectName, body, contentType, customMetadata)
  const response = await fetch(`${objects()}?name=${encodeURIComponent(objectName)}`, {
    method: "POST",
    headers: {
      Authorization: `Firebase ${token}`,
      "Content-Type": part.contentType,
      "X-Goog-Upload-Protocol": "multipart",
    },
    body: part.body,
  })
  if (!response.ok) throw new StorageError(response.status, await response.text())
  return (await response.json()) as ObjectMeta
}

export async function storageExists(token: string, objectName: string): Promise<boolean> {
  try {
    await storageMeta(token, objectName)
    return true
  } catch (error) {
    if (error instanceof StorageError && error.status === 404) return false
    throw error
  }
}

export type Listing = { prefixes: string[]; items: string[] }

// One folder level, the way the Firebase SDK lists: prefix plus "/" delimiter.
export async function listObjects(token: string, prefix: string): Promise<Listing> {
  const listing: Listing = { prefixes: [], items: [] }
  let pageToken: string | undefined
  do {
    const query = new URLSearchParams({ prefix, delimiter: "/", maxResults: "1000" })
    if (pageToken) query.set("pageToken", pageToken)
    const body = (await (await storageGet(token, `?${query}`)).json()) as {
      prefixes?: string[]
      items?: { name: string }[]
      nextPageToken?: string
    }
    listing.prefixes.push(...(body.prefixes ?? []))
    listing.items.push(...(body.items ?? []).map((item) => item.name))
    pageToken = body.nextPageToken
  } while (pageToken)
  return listing
}

export function mediaUrl(objectName: string, downloadToken: string): string {
  return `${objects()}/${encodeURIComponent(objectName)}?alt=media&token=${downloadToken}`
}

export function consoleUrl(folder: string): string {
  return `https://console.firebase.google.com/project/${PROJECT_ID}/storage/${BUCKET}/files/~2F${folder.split("/").join("~2F")}`
}
```

- [ ] **Step 5: Create `lib/studio/admin-auth.ts`**

```ts
import { isStudioAdmin } from "@/lib/studio/admin"
import { bearerToken, verifyIdToken, type VerifiedUser } from "@/lib/studio/verify-id-token"

// Every /api/admin route starts here. Returns the verified admin and their
// token, or the Response to send back.
export async function requireAdmin(request: Request): Promise<{ user: VerifiedUser; token: string } | Response> {
  const token = bearerToken(request)
  if (!token) return Response.json({ error: "Sign in again, then retry." }, { status: 401 })
  let user: VerifiedUser
  try {
    user = await verifyIdToken(token)
  } catch {
    return Response.json({ error: "Your sign-in expired. Sign in again, then retry." }, { status: 401 })
  }
  if (!isStudioAdmin(user.email)) {
    return Response.json({ error: "This page is only for the Studio admin account." }, { status: 403 })
  }
  if (!user.emailVerified) {
    return Response.json({ error: "Verify your email first.", code: "unverified" }, { status: 403 })
  }
  return { user, token }
}
```

- [ ] **Step 6: Point `submissions.ts` and the list route at the shared code**

In `lib/studio/submissions.ts`: delete `BUCKET`, `PROJECT_ID`, `storageBase`, `StorageError`, `storageGet`, `list`, `ObjectMeta`, `consoleUrl`; add

```ts
import { consoleUrl, listObjects, mediaUrl, storageGet, StorageError, type ObjectMeta } from "@/lib/studio/storage"
export { StorageError }
```

Replace every `list(` with `listObjects(`, and the video URL line with
`url: mediaUrl(recording, downloadToken)`. Keep `readSubmission`, `inBatches`, `loadSubmissions` as they are.

In `app/api/admin/submissions/route.ts` replace the token/verify/admin/verified block with:

```ts
import { requireAdmin } from "@/lib/studio/admin-auth"
…
export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (admin instanceof Response) return admin
  try {
    return Response.json({ submissions: await loadSubmissions(admin.token) })
  } catch (error) { … unchanged … }
}
```

- [ ] **Step 7: Run tests, typecheck, lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: 3 tests pass, no type or lint errors.

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts package.json package-lock.json lib/studio/storage.ts lib/studio/storage.test.ts lib/studio/admin-auth.ts lib/studio/submissions.ts app/api/admin/submissions/route.ts
git commit -m "Share the Storage REST helpers and the admin route guard; add Vitest"
```

---

### Task 2: Stage state machine and price table

**Files:**
- Create: `lib/studio/sample/status.ts`, `lib/studio/sample/status.test.ts`, `lib/studio/sample/costs.ts`, `lib/studio/sample/costs.test.ts`

**Interfaces:**
- Produces (status.ts):
  ```ts
  export const STAGES = ["prep", "script", "voice", "video", "audio", "render", "send"] as const
  export type Stage = (typeof STAGES)[number]
  export type Method = "real" | "scene" | "portrait"
  export type SampleOptions = { method: Method; background: "office" | "studio" | "street"; layout: "boxed" | "full"; mood: "calm" | "energetic"; faceFrame?: number; clipStart: number }
  export type StageJob = { provider: "fal" | "higgsfield" | "remotion" | "local"; id: string; step?: "scene" | "lipsync"; statusUrl?: string; responseUrl?: string; bucketName?: string }
  export type StageState = { state: "idle" | "running" | "done" | "failed" | "stale"; job?: StageJob; error?: string; startedAt?: string; finishedAt?: string; cost?: number }
  export type SampleStatus = { version: 1; options: SampleOptions; voiceId?: string; speechSeconds?: number; recordingSeconds?: number; scriptApproved?: boolean; assets: Record<string, string>; stages: Record<Stage, StageState> }
  export function defaultStatus(): SampleStatus
  export const DEPENDS: Record<Stage, Stage[]>
  export function blockers(status: SampleStatus, stage: Stage): string[]
  export function startStage(status, stage, now?: Date): SampleStatus
  export function setJob(status, stage, job: StageJob): SampleStatus
  export function finishStage(status, stage, patch?: { cost?: number } & Partial<Pick<SampleStatus, "voiceId" | "speechSeconds" | "recordingSeconds" | "assets">>, now?: Date): SampleStatus
  export function failStage(status, stage, error: string, now?: Date): SampleStatus
  export function timedOut(stage: StageState, now: Date): boolean
  export const TIMEOUT_MINUTES: Record<Stage, number>
  ```
- Produces (costs.ts): `PRICES`, `videoCost(method, seconds)`, `audioCost(seconds)`, `ttsCost(chars)`, `round2(n)`.

- [ ] **Step 1: Write the failing status tests**

`lib/studio/sample/status.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  blockers,
  defaultStatus,
  failStage,
  finishStage,
  startStage,
  timedOut,
  type SampleStatus,
} from "@/lib/studio/sample/status"

function withDone(status: SampleStatus, ...stages: Parameters<typeof finishStage>[1][]): SampleStatus {
  return stages.reduce((s, stage) => finishStage(startStage(s, stage), stage), status)
}

describe("blockers", () => {
  it("lets prep and script run on a fresh status", () => {
    const s = defaultStatus()
    expect(blockers(s, "prep")).toEqual([])
    expect(blockers(s, "script")).toEqual([])
  })

  it("holds voice until prep is done and the script is approved", () => {
    const s = withDone(defaultStatus(), "prep")
    expect(blockers(s, "voice")).toEqual(["Approve the script first."])
    expect(blockers({ ...s, scriptApproved: true }, "voice")).toEqual([])
    expect(blockers({ ...defaultStatus(), scriptApproved: true }, "voice")).toEqual(["Run Prep first."])
  })

  it("needs a picked face frame for scene and portrait, not for real", () => {
    const base = withDone({ ...defaultStatus(), scriptApproved: true }, "prep", "script", "voice")
    expect(blockers({ ...base, options: { ...base.options, method: "scene" } }, "video")).toEqual(["Pick a face frame first."])
    expect(blockers({ ...base, options: { ...base.options, method: "portrait", faceFrame: 3 } }, "video")).toEqual([])
    expect(blockers({ ...base, options: { ...base.options, method: "real" } }, "video")).toEqual([])
  })

  it("refuses to run while already running", () => {
    const s = startStage(defaultStatus(), "prep")
    expect(blockers(s, "prep")).toEqual(["Prep is already running."])
  })
})

describe("startStage", () => {
  it("marks later finished stages stale and leaves earlier ones alone", () => {
    const s = withDone({ ...defaultStatus(), scriptApproved: true }, "prep", "script", "voice", "audio")
    const again = startStage(s, "script")
    expect(again.stages.script.state).toBe("running")
    expect(again.stages.prep.state).toBe("done")
    expect(again.stages.voice.state).toBe("stale")
    expect(again.stages.audio.state).toBe("stale")
    expect(again.stages.video.state).toBe("idle")
    expect(again.scriptApproved).toBe(false)
  })

  it("blocks video when voice is stale", () => {
    const s = withDone({ ...defaultStatus(), scriptApproved: true }, "prep", "script", "voice")
    const again = finishStage(startStage(s, "script"), "script")
    expect(blockers({ ...again, scriptApproved: true }, "video")).toEqual(["Run Voice again first."])
  })

  it("clears the previous error and job", () => {
    const failed = failStage(startStage(defaultStatus(), "prep"), "prep", "boom")
    const retry = startStage(failed, "prep")
    expect(retry.stages.prep.error).toBeUndefined()
    expect(retry.stages.prep.state).toBe("running")
  })
})

describe("finishStage / failStage", () => {
  it("records cost, finishedAt and patches", () => {
    const s = finishStage(startStage(defaultStatus(), "voice"), "voice", { cost: 0.05, voiceId: "v1", speechSeconds: 24.2 })
    expect(s.stages.voice).toMatchObject({ state: "done", cost: 0.05 })
    expect(s.stages.voice.finishedAt).toBeTruthy()
    expect(s.voiceId).toBe("v1")
    expect(s.speechSeconds).toBe(24.2)
  })

  it("merges assets instead of replacing them", () => {
    const a = finishStage(startStage(defaultStatus(), "prep"), "prep", { assets: { "face-1.jpg": "u1" } })
    const b = finishStage(startStage(a, "voice"), "voice", { assets: { "speech.mp3": "u2" } })
    expect(b.assets).toEqual({ "face-1.jpg": "u1", "speech.mp3": "u2" })
  })

  it("keeps the error short", () => {
    const s = failStage(startStage(defaultStatus(), "prep"), "prep", "x".repeat(1000))
    expect(s.stages.prep.state).toBe("failed")
    expect(s.stages.prep.error!.length).toBeLessThanOrEqual(400)
  })
})

describe("timedOut", () => {
  it("uses the per-stage limit", () => {
    const started = new Date("2026-10-09T10:00:00Z")
    const s = startStage(defaultStatus(), "video", started)
    expect(timedOut(s.stages.video, new Date("2026-10-09T10:14:00Z"), "video")).toBe(false)
    expect(timedOut(s.stages.video, new Date("2026-10-09T10:16:00Z"), "video")).toBe(true)
    const r = startStage(defaultStatus(), "render", started)
    expect(timedOut(r.stages.render, new Date("2026-10-09T10:11:00Z"), "render")).toBe(true)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- lib/studio/sample/status.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/studio/sample/status.ts`**

```ts
// status.json for one sample: which stages ran, what they produced, what
// they cost. Pure functions so the routes stay thin and this stays testable.
export const STAGES = ["prep", "script", "voice", "video", "audio", "render", "send"] as const
export type Stage = (typeof STAGES)[number]

export type Method = "real" | "scene" | "portrait"
export type Background = "office" | "studio" | "street"

export type SampleOptions = {
  method: Method
  background: Background
  layout: "boxed" | "full"
  mood: "calm" | "energetic"
  /** 1–5, which face-N.jpg to use for scene and portrait. */
  faceFrame?: number
  /** Method real: seconds into the recording where the clip starts. */
  clipStart: number
}

export type StageJob = {
  provider: "fal" | "higgsfield" | "remotion" | "local"
  id: string
  step?: "scene" | "lipsync"
  statusUrl?: string
  responseUrl?: string
  bucketName?: string
}

export type StageState = {
  state: "idle" | "running" | "done" | "failed" | "stale"
  job?: StageJob
  error?: string
  startedAt?: string
  finishedAt?: string
  cost?: number
}

export type SampleStatus = {
  version: 1
  options: SampleOptions
  voiceId?: string
  speechSeconds?: number
  recordingSeconds?: number
  scriptApproved?: boolean
  /** file name under sample/ → public media URL (download token) */
  assets: Record<string, string>
  stages: Record<Stage, StageState>
}

export const STAGE_LABEL: Record<Stage, string> = {
  prep: "Prep",
  script: "Script",
  voice: "Voice",
  video: "Video",
  audio: "Audio",
  render: "Render",
  send: "Send",
}

export const DEPENDS: Record<Stage, Stage[]> = {
  prep: [],
  script: [],
  voice: ["prep", "script"],
  video: ["voice"],
  audio: ["voice"],
  render: ["video", "audio"],
  send: ["render"],
}

export const TIMEOUT_MINUTES: Record<Stage, number> = {
  prep: 5,
  script: 5,
  voice: 5,
  video: 15,
  audio: 5,
  render: 10,
  send: 5,
}

export function defaultStatus(): SampleStatus {
  return {
    version: 1,
    options: { method: "real", background: "office", layout: "boxed", mood: "calm", clipStart: 15 },
    assets: {},
    stages: Object.fromEntries(STAGES.map((s) => [s, { state: "idle" }])) as Record<Stage, StageState>,
  }
}

export function blockers(status: SampleStatus, stage: Stage): string[] {
  const out: string[] = []
  if (status.stages[stage].state === "running") return [`${STAGE_LABEL[stage]} is already running.`]
  for (const dep of DEPENDS[stage]) {
    const state = status.stages[dep].state
    if (state === "stale") out.push(`Run ${STAGE_LABEL[dep]} again first.`)
    else if (state !== "done") out.push(`Run ${STAGE_LABEL[dep]} first.`)
  }
  if (stage === "voice" && !status.scriptApproved) out.push("Approve the script first.")
  if (stage === "video" && status.options.method !== "real" && !status.options.faceFrame) out.push("Pick a face frame first.")
  return out
}

function patchStage(status: SampleStatus, stage: Stage, patch: StageState): SampleStatus {
  return { ...status, stages: { ...status.stages, [stage]: patch } }
}

export function startStage(status: SampleStatus, stage: Stage, now = new Date()): SampleStatus {
  let next = patchStage(status, stage, { state: "running", startedAt: now.toISOString() })
  // Anything built on this stage's old output is now out of date.
  for (const later of STAGES.slice(STAGES.indexOf(stage) + 1)) {
    if (next.stages[later].state === "done") next = patchStage(next, later, { ...next.stages[later], state: "stale" })
  }
  if (stage === "script") next = { ...next, scriptApproved: false }
  return next
}

export function setJob(status: SampleStatus, stage: Stage, job: StageJob): SampleStatus {
  return patchStage(status, stage, { ...status.stages[stage], job })
}

export function finishStage(
  status: SampleStatus,
  stage: Stage,
  patch: { cost?: number } & Partial<Pick<SampleStatus, "voiceId" | "speechSeconds" | "recordingSeconds" | "assets">> = {},
  now = new Date(),
): SampleStatus {
  const { cost, assets, ...rest } = patch
  const prev = status.stages[stage]
  return {
    ...patchStage(status, stage, {
      state: "done",
      startedAt: prev.startedAt,
      finishedAt: now.toISOString(),
      ...(cost !== undefined ? { cost } : prev.cost !== undefined ? { cost: prev.cost } : {}),
    }),
    ...rest,
    assets: { ...status.assets, ...(assets ?? {}) },
  }
}

export function failStage(status: SampleStatus, stage: Stage, error: string, now = new Date()): SampleStatus {
  const prev = status.stages[stage]
  return patchStage(status, stage, {
    state: "failed",
    startedAt: prev.startedAt,
    finishedAt: now.toISOString(),
    error: error.slice(0, 400),
    ...(prev.cost !== undefined ? { cost: prev.cost } : {}),
  })
}

export function timedOut(state: StageState, now: Date, stage: Stage): boolean {
  if (state.state !== "running" || !state.startedAt) return false
  return now.getTime() - Date.parse(state.startedAt) > TIMEOUT_MINUTES[stage] * 60_000
}
```

Note the `timedOut(state, now, stage)` argument order — the test calls it that way.

- [ ] **Step 4: Write the failing costs test**

`lib/studio/sample/costs.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { audioCost, ttsCost, videoCost } from "@/lib/studio/sample/costs"

describe("costs", () => {
  it("prices each method for a 26 s clip", () => {
    expect(videoCost("real", 26)).toBeCloseTo(2.17, 2) // 26/60 * 5
    expect(videoCost("scene", 26)).toBeCloseTo(26 * 0.144 + 2.17, 2)
    expect(videoCost("portrait", 26)).toBeCloseTo(26 * 0.16, 2)
  })
  it("prices audio and tts", () => {
    expect(audioCost(26)).toBeCloseTo(((26 + 3) / 60) * 0.15 + 2 * 0.12, 2)
    expect(ttsCost(450)).toBeCloseTo(0.036, 3)
  })
})
```

- [ ] **Step 5: Create `lib/studio/sample/costs.ts`**

```ts
import type { Method } from "@/lib/studio/sample/status"

// Public list prices on 2026-10-09 (see the spec). Only this file knows them,
// so status.json totals stay comparable when a price moves.
export const PRICES = {
  seedancePerSecond: 0.144, // sale; list is 0.2057
  lipsyncPerMinute: 5,
  omnihumanPerSecond: 0.16,
  ttsPer1kChars: 0.08,
  musicPerMinute: 0.15,
  sfxPerGeneration: 0.12,
  scriptCall: 0.1,
}

export const round2 = (n: number) => Math.round(n * 100) / 100

export function videoCost(method: Method, seconds: number): number {
  const lipsync = (seconds / 60) * PRICES.lipsyncPerMinute
  if (method === "real") return round2(lipsync)
  if (method === "scene") return round2(seconds * PRICES.seedancePerSecond + lipsync)
  return round2(seconds * PRICES.omnihumanPerSecond)
}

export function audioCost(speechSeconds: number): number {
  return round2(((speechSeconds + 3) / 60) * PRICES.musicPerMinute + 2 * PRICES.sfxPerGeneration)
}

export function ttsCost(chars: number): number {
  return Math.round((chars / 1000) * PRICES.ttsPer1kChars * 1000) / 1000
}
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add lib/studio/sample/status.ts lib/studio/sample/status.test.ts lib/studio/sample/costs.ts lib/studio/sample/costs.test.ts
git commit -m "Model the sample pipeline's stages and prices"
```

---

### Task 3: Sample context, status / options / script routes

**Files:**
- Create: `lib/studio/sample/context.ts`, `lib/studio/sample/context.test.ts`, `app/api/admin/sample/status/route.ts`, `app/api/admin/sample/options/route.ts`, `app/api/admin/sample/script/route.ts`

**Interfaces:**
- Produces:
  ```ts
  export type SampleRef = { uid: string; submissionId: string; folder: string; sampleFolder: string }
  export function parseSampleId(id: unknown): SampleRef | null         // "uid/submissionId"
  export function sampleFile(ref: SampleRef, name: string): string     // "studio/uid/sub/sample/name"
  export async function readStatus(token, ref): Promise<SampleStatus>  // default when missing
  export async function writeStatus(token, ref, status): Promise<void>
  export function storageFailure(error: unknown): Response | null       // 401/403 → the "publish storage.rules" 502, else null
  export function parseOptions(value: unknown, current: SampleOptions): SampleOptions
  export async function openSample(request, idFromBody?: unknown): Promise<{ token: string; ref: SampleRef; status: SampleStatus } | Response>
  ```
- Script file shape used by the script route and later tasks:
  ```ts
  export type ScriptFile = { draft: Script; approved: boolean; model: string; createdAt: string; editedAt?: string; notes?: string; searchSources: string[] }
  ```
  (`Script` is defined in Task 6; this task only stores whatever JSON the admin sends under `draft` after `validateScript` from Task 6 — so implement Task 6's `validateScript` stub-free first or order this route's validation call after Task 6. To keep tasks independent, this task validates only the shape `{ draft: object, approved: boolean }` and Task 6 adds `validateScript` to the PUT.)

- [ ] **Step 1: Write failing tests**

`lib/studio/sample/context.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { parseOptions, parseSampleId, sampleFile, storageFailure } from "@/lib/studio/sample/context"
import { defaultStatus } from "@/lib/studio/sample/status"
import { StorageError } from "@/lib/studio/storage"

describe("parseSampleId", () => {
  it("accepts uid/submissionId", () => {
    expect(parseSampleId("abcDEF123/20261009T120000-1a2b3c4d")).toEqual({
      uid: "abcDEF123",
      submissionId: "20261009T120000-1a2b3c4d",
      folder: "studio/abcDEF123/20261009T120000-1a2b3c4d",
      sampleFolder: "studio/abcDEF123/20261009T120000-1a2b3c4d/sample",
    })
  })
  it("rejects anything that could escape the folder", () => {
    for (const bad of ["", "a", "a/b/c", "../x/y", "a/..", "a b/c", 42, null, "a/b%2F"]) {
      expect(parseSampleId(bad)).toBeNull()
    }
  })
  it("builds file paths", () => {
    expect(sampleFile(parseSampleId("u/s")!, "speech.mp3")).toBe("studio/u/s/sample/speech.mp3")
  })
})

describe("parseOptions", () => {
  it("keeps current values for anything invalid", () => {
    const current = defaultStatus().options
    expect(parseOptions({ method: "scene", background: "nope", layout: "full", mood: 3, faceFrame: 9, clipStart: "20" }, current)).toEqual({
      ...current,
      method: "scene",
      layout: "full",
      clipStart: 20,
    })
    expect(parseOptions({ faceFrame: 4, clipStart: -5 }, current)).toEqual({ ...current, faceFrame: 4 })
  })
})

describe("storageFailure", () => {
  it("maps rule denials to the publish-rules message", async () => {
    const res = storageFailure(new StorageError(403, "denied"))!
    expect(res.status).toBe(502)
    expect((await res.json()).error).toMatch(/storage\.rules/)
    expect(storageFailure(new StorageError(500, "x"))).toBeNull()
    expect(storageFailure(new Error("x"))).toBeNull()
  })
})
```

- [ ] **Step 2: Run, expect module-not-found failure**

Run: `npm test -- lib/studio/sample/context.test.ts`

- [ ] **Step 3: Create `lib/studio/sample/context.ts`**

```ts
import { requireAdmin } from "@/lib/studio/admin-auth"
import { defaultStatus, type SampleOptions, type SampleStatus } from "@/lib/studio/sample/status"
import { StorageError, storageJson, storageUpload } from "@/lib/studio/storage"

export type SampleRef = { uid: string; submissionId: string; folder: string; sampleFolder: string }

const SEGMENT = /^[\w-]+$/

// "uid/submissionId" as the admin page sends it. Both halves are single path
// segments, so nothing can point outside studio/.
export function parseSampleId(id: unknown): SampleRef | null {
  if (typeof id !== "string") return null
  const parts = id.split("/")
  if (parts.length !== 2 || !parts.every((p) => SEGMENT.test(p))) return null
  const [uid, submissionId] = parts
  const folder = `studio/${uid}/${submissionId}`
  return { uid, submissionId, folder, sampleFolder: `${folder}/sample` }
}

export function sampleFile(ref: SampleRef, name: string): string {
  return `${ref.sampleFolder}/${name}`
}

export async function readStatus(token: string, ref: SampleRef): Promise<SampleStatus> {
  try {
    const status = await storageJson<SampleStatus>(token, sampleFile(ref, "status.json"))
    return { ...defaultStatus(), ...status, options: { ...defaultStatus().options, ...status.options } }
  } catch (error) {
    if (error instanceof StorageError && error.status === 404) return defaultStatus()
    throw error
  }
}

export async function writeStatus(token: string, ref: SampleRef, status: SampleStatus): Promise<void> {
  await storageUpload(token, sampleFile(ref, "status.json"), JSON.stringify(status, null, 2), "application/json")
}

export function storageFailure(error: unknown): Response | null {
  if (error instanceof StorageError && (error.status === 401 || error.status === 403)) {
    return Response.json(
      { error: "Storage refused the request. Publish the latest docs/studio-capture/storage.rules, then reload." },
      { status: 502 },
    )
  }
  return null
}

const METHODS = ["real", "scene", "portrait"] as const
const BACKGROUNDS = ["office", "studio", "street"] as const
const LAYOUTS = ["boxed", "full"] as const
const MOODS = ["calm", "energetic"] as const

function pick<T extends string>(value: unknown, allowed: readonly T[], current: T): T {
  return allowed.includes(value as T) ? (value as T) : current
}

export function parseOptions(value: unknown, current: SampleOptions): SampleOptions {
  const v = (value ?? {}) as Record<string, unknown>
  const faceFrame = Number(v.faceFrame)
  const clipStart = Number(v.clipStart)
  return {
    method: pick(v.method, METHODS, current.method),
    background: pick(v.background, BACKGROUNDS, current.background),
    layout: pick(v.layout, LAYOUTS, current.layout),
    mood: pick(v.mood, MOODS, current.mood),
    faceFrame: Number.isInteger(faceFrame) && faceFrame >= 1 && faceFrame <= 5 ? faceFrame : current.faceFrame,
    clipStart: Number.isFinite(clipStart) && clipStart >= 0 && clipStart <= 170 ? clipStart : current.clipStart,
  }
}

// Auth + id + status in one go; every sample route starts with this.
export async function openSample(
  request: Request,
  idFromBody?: unknown,
): Promise<{ token: string; ref: SampleRef; status: SampleStatus } | Response> {
  const admin = await requireAdmin(request)
  if (admin instanceof Response) return admin
  const ref = parseSampleId(idFromBody ?? new URL(request.url).searchParams.get("id"))
  if (!ref) return Response.json({ error: "Unknown submission." }, { status: 400 })
  try {
    return { token: admin.token, ref, status: await readStatus(admin.token, ref) }
  } catch (error) {
    return storageFailure(error) ?? Response.json({ error: "We couldn't read the sample status." }, { status: 500 })
  }
}

export async function jsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Routes**

`app/api/admin/sample/status/route.ts`:

```ts
import { openSample } from "@/lib/studio/sample/context"

export async function GET(request: Request) {
  const sample = await openSample(request)
  if (sample instanceof Response) return sample
  return Response.json(sample.status)
}
```

`app/api/admin/sample/options/route.ts`:

```ts
import { jsonBody, openSample, parseOptions, storageFailure, writeStatus } from "@/lib/studio/sample/context"

export async function PUT(request: Request) {
  const body = await jsonBody(request)
  if (!body) return Response.json({ error: "Invalid request body." }, { status: 400 })
  const sample = await openSample(request, body.id)
  if (sample instanceof Response) return sample
  const status = { ...sample.status, options: parseOptions(body.options, sample.status.options) }
  try {
    await writeStatus(sample.token, sample.ref, status)
  } catch (error) {
    return storageFailure(error) ?? Response.json({ error: "We couldn't save the options." }, { status: 500 })
  }
  return Response.json(status)
}
```

`app/api/admin/sample/script/route.ts` (the admin saved edits; `approved` gates Voice):

```ts
import { jsonBody, openSample, sampleFile, storageFailure, writeStatus } from "@/lib/studio/sample/context"
import { storageJson, storageUpload } from "@/lib/studio/storage"

type ScriptFile = { draft: unknown; approved: boolean; model: string; createdAt: string; editedAt?: string; notes?: string; searchSources: string[] }

export async function PUT(request: Request) {
  const body = await jsonBody(request)
  if (!body || typeof body.draft !== "object" || body.draft === null) {
    return Response.json({ error: "Invalid request body." }, { status: 400 })
  }
  const sample = await openSample(request, body.id)
  if (sample instanceof Response) return sample
  const path = sampleFile(sample.ref, "script.json")
  try {
    const current = await storageJson<ScriptFile>(sample.token, path)
    const next: ScriptFile = {
      ...current,
      draft: body.draft,
      approved: body.approved === true,
      editedAt: new Date().toISOString(),
    }
    await storageUpload(sample.token, path, JSON.stringify(next, null, 2), "application/json")
    const status = { ...sample.status, scriptApproved: next.approved }
    await writeStatus(sample.token, sample.ref, status)
    return Response.json({ status, script: next })
  } catch (error) {
    return storageFailure(error) ?? Response.json({ error: "We couldn't save the script." }, { status: 500 })
  }
}
```

(Task 6 adds `validateScript(body.draft)` before saving and returns its errors with 400.)

- [ ] **Step 5: Run tests, typecheck, lint; smoke the status route**

Run: `npm test && npx tsc --noEmit && npm run lint`
Then with `npm run dev` running: `curl -s "localhost:3000/api/admin/sample/status?id=u/s"` → `{"error":"Sign in again, then retry."}`.

- [ ] **Step 6: Commit**

```bash
git add lib/studio/sample/context.ts lib/studio/sample/context.test.ts app/api/admin/sample
git commit -m "Add the sample status, options and script routes"
```

---

### Task 4: Storage rules — admin writes under studio/**

**Files:**
- Modify: `docs/studio-capture/storage.rules`, `docs/studio-capture/rules-test.mjs`, `docs/studio-capture/README.md`

- [ ] **Step 1: Extend the admin rule**

In `storage.rules`, replace the `match /studio/{allPaths=**}` block with:

```
    match /studio/{allPaths=**} {
      allow read, write: if request.auth != null
                         && request.auth.token.email == 'bkim@vflo.app'
                         && request.auth.token.email_verified == true;
    }
```

Update the comment above it: "…only the Studio admin account (studio.visaflo.ca/admin) can list and read every submission, and writes the generated sample into `{submissionId}/sample/`."

- [ ] **Step 2: Add cases to `rules-test.mjs`**

After the existing `adminRead("ALLOW", …)` line add:

```js
// The admin also writes the generated sample next to the recording; nobody
// else can write there, not even the owner.
async function tryWrite(label, path, expect) {
  let got
  try { await uploadBytes(ref(st, path), new Blob(["{}"], { type: "application/json" }), { contentType: "application/json" }); got = "ALLOW" } catch (e) { got = e.code === "storage/unauthorized" ? "DENY" : `ERR ${e.code}` }
  if (got !== expect) fail++
  console.log(`${got === expect ? "ok  " : "FAIL"} ${label}: ${got}`)
}
await as(ADMIN)
await tryWrite("admin writes sample/status.json", `studio/${a}/s1/sample/status.json`, "ALLOW")
await setVerified(false)
await as(ADMIN)
await tryWrite("unverified admin writes sample/status.json", `studio/${a}/s1/sample/status.json`, "DENY")
await setVerified(true)
await as(`sdk-a-${stamp}@example.test`)
await tryWrite("owner writes own sample/status.json", `studio/${a}/s1/sample/status.json`, "DENY")
```

Update the README's "17 cases" to "20 cases, including the admin reads and writes".

- [ ] **Step 3: Run the matrix against the emulators**

```bash
firebase emulators:start --only auth,storage --project demo-studio   # terminal 1, from docs/studio-capture
node docs/studio-capture/rules-test.mjs                               # terminal 2
```
Expected: `all passed`.

- [ ] **Step 4: Publish and commit**

Publish `storage.rules` to the `devdashboard-c9159-ca` bucket (console or `firebase deploy --only storage`), then:

```bash
git add docs/studio-capture
git commit -m "Let the Studio admin write generated samples under studio/"
```

---

### Task 5: ffmpeg helpers, the stage runner route, and Prep

**Files:**
- Create: `lib/studio/sample/ffmpeg.ts`, `lib/studio/sample/ffmpeg.test.ts`, `lib/studio/sample/stages.ts`, `app/api/admin/sample/run/[stage]/route.ts`
- Modify: `package.json` (dep `ffmpeg-static`), `next.config.ts` (trace the binary)

**Interfaces:**
- Produces (ffmpeg.ts):
  ```ts
  export async function tmpDir(): Promise<string>
  export async function downloadTo(response: Response, file: string): Promise<void>
  export async function probeSeconds(file: string): Promise<number>
  export function voiceWindow(duration: number): { start: number; seconds: number }
  export function frameTimes(duration: number): number[]            // 5 times
  export async function extractVoiceSample(input: string, out: string, duration: number): Promise<void>
  export async function extractFrame(input: string, out: string, at: number): Promise<void>
  export async function cutClip(input: string, out: string, opts: { start: number; seconds: number; crop: boolean }): Promise<void>
  ```
- Produces (stages.ts):
  ```ts
  export type StageContext = { token: string; ref: SampleRef; status: SampleStatus; body: Record<string, unknown> }
  export type StageOutcome = { done: true; cost?: number; patch?: StagePatch } | { done: false; job: StageJob }
  export type StagePatch = Partial<Pick<SampleStatus, "voiceId" | "speechSeconds" | "recordingSeconds" | "assets">>
  export type StageWork = (ctx: StageContext) => Promise<StageOutcome>
  export const STAGE_WORK: Partial<Record<Stage, StageWork>>     // this task registers prep; later tasks add the rest
  export async function uploadAsset(token, ref, name, bytes, contentType): Promise<string>   // returns media URL
  export function describeError(error: unknown): string
  ```
- Consumes: Task 1 storage helpers, Task 2 status functions, Task 3 `openSample`/`jsonBody`/`sampleFile`/`writeStatus`.

- [ ] **Step 1: Install ffmpeg-static and trace it**

```bash
npm i ffmpeg-static
```

`next.config.ts` → inside `outputFileTracingIncludes` add:

```ts
"/api/admin/sample/run/[stage]": ["./node_modules/ffmpeg-static/ffmpeg"],
```

- [ ] **Step 2: Write the failing ffmpeg test**

`lib/studio/sample/ffmpeg.test.ts`:

```ts
import { execFile } from "node:child_process"
import { stat } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import ffmpegPath from "ffmpeg-static"
import { beforeAll, describe, expect, it } from "vitest"

import { cutClip, extractFrame, extractVoiceSample, frameTimes, probeSeconds, tmpDir, voiceWindow } from "@/lib/studio/sample/ffmpeg"

const run = promisify(execFile)
let dir: string
let input: string

beforeAll(async () => {
  dir = await tmpDir()
  input = path.join(dir, "in.mp4")
  // 8 s of test pattern + tone: shorter than the 75 s a full recording has.
  await run(ffmpegPath as string, [
    "-y", "-f", "lavfi", "-i", "testsrc=duration=8:size=640x360:rate=10",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=8",
    "-shortest", "-pix_fmt", "yuv420p", input,
  ])
}, 60_000)

describe("windows", () => {
  it("skips the head turn on a full recording", () => {
    expect(voiceWindow(90)).toEqual({ start: 15, seconds: 60 })
  })
  it("clamps to a short recording", () => {
    expect(voiceWindow(8)).toEqual({ start: 1.2, seconds: 6.8 })
    expect(frameTimes(8).every((t) => t > 0 && t <= 7.5)).toBe(true)
    expect(frameTimes(8)).toHaveLength(5)
  })
})

describe("ffmpeg", () => {
  it("probes duration", async () => {
    expect(await probeSeconds(input)).toBeCloseTo(8, 0)
  })
  it("extracts a non-empty voice sample from a short file", async () => {
    const out = path.join(dir, "voice.wav")
    await extractVoiceSample(input, out, 8)
    expect((await stat(out)).size).toBeGreaterThan(100_000)
    expect(await probeSeconds(out)).toBeCloseTo(6.8, 0)
  })
  it("extracts a frame", async () => {
    const out = path.join(dir, "f.jpg")
    await extractFrame(input, out, 7.2)
    expect((await stat(out)).size).toBeGreaterThan(1000)
  })
  it("cuts and crops a clip", async () => {
    const out = path.join(dir, "clip.mp4")
    await cutClip(input, out, { start: 2, seconds: 3, crop: true })
    expect(await probeSeconds(out)).toBeCloseTo(3, 0)
    const { stderr } = await run(ffmpegPath as string, ["-i", out]).catch((e) => e as { stderr: string })
    expect(stderr).toMatch(/ 202x360| 203x360/) // 9:16 of 360 high
  })
}, 60_000)
```

- [ ] **Step 3: Run, expect failure**

Run: `npm test -- lib/studio/sample/ffmpeg.test.ts`

- [ ] **Step 4: Create `lib/studio/sample/ffmpeg.ts`**

```ts
import { execFile } from "node:child_process"
import { createWriteStream } from "node:fs"
import { mkdtemp } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { promisify } from "node:util"
import ffmpegPath from "ffmpeg-static"

const run = promisify(execFile)
const FFMPEG = ffmpegPath as string

// Everything here works on files in a fresh temp dir: Vercel functions give
// us a writable /tmp and nothing else.
export async function tmpDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "sample-"))
}

export async function downloadTo(response: Response, file: string): Promise<void> {
  if (!response.body) throw new Error("Empty download")
  await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream), createWriteStream(file))
}

async function ffmpeg(args: string[]): Promise<string> {
  try {
    const { stderr } = await run(FFMPEG, ["-hide_banner", "-y", ...args], { maxBuffer: 16 * 1024 * 1024 })
    return stderr
  } catch (error) {
    const e = error as { stderr?: string; message: string }
    throw new Error(`ffmpeg failed: ${(e.stderr ?? e.message).split("\n").filter(Boolean).slice(-3).join(" | ")}`)
  }
}

// ffmpeg-static ships no ffprobe; "-i file" alone prints the duration.
export async function probeSeconds(file: string): Promise<number> {
  const stderr = await run(FFMPEG, ["-hide_banner", "-i", file]).then(
    (r) => r.stderr,
    (e: { stderr?: string }) => e.stderr ?? "",
  )
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr)
  if (!m) throw new Error("ffmpeg could not read the duration")
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

// A full recording is ~90 s: skip the head turn and first line (15 s) and
// keep a minute. Shorter files keep the same proportion.
export function voiceWindow(duration: number): { start: number; seconds: number } {
  if (duration >= 75) return { start: 15, seconds: 60 }
  const start = Math.round(Math.min(15, duration * 0.15) * 10) / 10
  return { start, seconds: Math.round((duration - start) * 10) / 10 }
}

export function frameTimes(duration: number): number[] {
  return [0.3, 0.45, 0.6, 0.75, 0.9].map((f) => Math.min(Math.round(f * duration * 10) / 10, Math.max(0.1, duration - 0.5)))
}

export async function extractVoiceSample(input: string, out: string, duration: number): Promise<void> {
  const { start, seconds } = voiceWindow(duration)
  await ffmpeg(["-ss", String(start), "-t", String(seconds), "-i", input, "-vn", "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", out])
}

export async function extractFrame(input: string, out: string, at: number): Promise<void> {
  await ffmpeg(["-ss", String(at), "-i", input, "-frames:v", "1", "-q:v", "2", out])
}

// Method A: the part of the recording that will carry the new speech. crop
// turns 16:9 into a centred 9:16 column scaled to 1080×1920.
export async function cutClip(input: string, out: string, opts: { start: number; seconds: number; crop: boolean }): Promise<void> {
  const filters = opts.crop ? ["-vf", "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920"] : []
  await ffmpeg([
    "-ss", String(opts.start), "-t", String(opts.seconds), "-i", input,
    ...filters, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out,
  ])
}
```

Add `declare module "ffmpeg-static"` only if `npx tsc --noEmit` complains (the package ships types).

- [ ] **Step 5: Run the ffmpeg tests**

Run: `npm test -- lib/studio/sample/ffmpeg.test.ts`
Expected: PASS (first run downloads nothing; ffmpeg-static's binary came with `npm i`).

- [ ] **Step 6: Create `lib/studio/sample/stages.ts` with the Prep work**

```ts
import { readFile } from "node:fs/promises"
import path from "node:path"

import { sampleFile, type SampleRef } from "@/lib/studio/sample/context"
import { downloadTo, extractFrame, extractVoiceSample, frameTimes, probeSeconds, tmpDir } from "@/lib/studio/sample/ffmpeg"
import type { SampleStatus, Stage, StageJob } from "@/lib/studio/sample/status"
import { listObjects, mediaUrl, storageGet, storageMeta, storageUpload, StorageError } from "@/lib/studio/storage"

export type StagePatch = Partial<Pick<SampleStatus, "voiceId" | "speechSeconds" | "recordingSeconds" | "assets">>
export type StageOutcome = { done: true; cost?: number; patch?: StagePatch } | { done: false; job: StageJob }
export type StageContext = { token: string; ref: SampleRef; status: SampleStatus; body: Record<string, unknown> }
export type StageWork = (ctx: StageContext) => Promise<StageOutcome>

// Uploads one sample artefact and returns the URL external APIs can fetch.
export async function uploadAsset(
  token: string,
  ref: SampleRef,
  name: string,
  bytes: Uint8Array | string,
  contentType: string,
): Promise<string> {
  const meta = await storageUpload(token, sampleFile(ref, name), bytes, contentType)
  const downloadToken = meta.downloadTokens?.split(",")[0]
  if (!downloadToken) throw new Error(`${name} uploaded without a download token`)
  return mediaUrl(sampleFile(ref, name), downloadToken)
}

export function describeError(error: unknown): string {
  if (error instanceof StorageError) return `Storage ${error.status}: publish the latest storage.rules if this is 401/403.`
  return error instanceof Error ? error.message : String(error)
}

export async function findRecording(token: string, ref: SampleRef): Promise<string> {
  const { items } = await listObjects(token, `${ref.folder}/`)
  const recording = items.find((name) => /\/recording\.\w+$/.test(name))
  if (!recording) throw new Error("No recording file in this folder")
  return recording
}

export async function downloadRecording(token: string, ref: SampleRef, dir: string): Promise<{ file: string; seconds: number }> {
  const name = await findRecording(token, ref)
  const meta = await storageMeta(token, name)
  const file = path.join(dir, `recording${path.extname(name)}`)
  await downloadTo(await storageGet(token, `/${encodeURIComponent(name)}?alt=media`), file)
  const seconds = Number(meta.metadata?.seconds) || (await probeSeconds(file))
  return { file, seconds }
}

const prep: StageWork = async ({ token, ref }) => {
  const dir = await tmpDir()
  const { file, seconds } = await downloadRecording(token, ref, dir)
  const assets: Record<string, string> = {}

  const wav = path.join(dir, "voice-sample.wav")
  await extractVoiceSample(file, wav, seconds)
  assets["voice-sample.wav"] = await uploadAsset(token, ref, "voice-sample.wav", await readFile(wav), "audio/wav")

  const times = frameTimes(seconds)
  for (let i = 0; i < times.length; i++) {
    const jpg = path.join(dir, `face-${i + 1}.jpg`)
    await extractFrame(file, jpg, times[i])
    assets[`face-${i + 1}.jpg`] = await uploadAsset(token, ref, `face-${i + 1}.jpg`, await readFile(jpg), "image/jpeg")
  }
  return { done: true, patch: { recordingSeconds: seconds, assets } }
}

export const STAGE_WORK: Partial<Record<Stage, StageWork>> = { prep }
```

- [ ] **Step 7: Create `app/api/admin/sample/run/[stage]/route.ts`**

```ts
import { jsonBody, openSample, storageFailure, writeStatus } from "@/lib/studio/sample/context"
import { describeError, STAGE_WORK } from "@/lib/studio/sample/stages"
import { blockers, failStage, finishStage, setJob, STAGES, startStage, type Stage } from "@/lib/studio/sample/status"

// Downloads, ffmpeg and provider calls can take a few minutes.
export const maxDuration = 300

export async function POST(request: Request, { params }: { params: Promise<{ stage: string }> }) {
  const { stage } = await params
  const work = STAGES.includes(stage as Stage) ? STAGE_WORK[stage as Stage] : undefined
  if (!work) return Response.json({ error: "Unknown stage." }, { status: 404 })

  const body = (await jsonBody(request)) ?? {}
  const sample = await openSample(request, body.id)
  if (sample instanceof Response) return sample
  const { token, ref } = sample

  const reasons = blockers(sample.status, stage as Stage)
  if (reasons.length) return Response.json({ error: reasons.join(" "), status: sample.status }, { status: 409 })

  let status = startStage(sample.status, stage as Stage)
  try {
    await writeStatus(token, ref, status)
  } catch (error) {
    return storageFailure(error) ?? Response.json({ error: "We couldn't save the sample status." }, { status: 500 })
  }

  try {
    const outcome = await work({ token, ref, status, body })
    status = outcome.done
      ? finishStage(status, stage as Stage, { cost: outcome.cost, ...outcome.patch })
      : setJob(status, stage as Stage, outcome.job)
  } catch (error) {
    console.error(`Sample stage ${stage} failed for ${ref.folder}`, error)
    status = failStage(status, stage as Stage, describeError(error))
  }
  await writeStatus(token, ref, status)
  return Response.json(status)
}
```

- [ ] **Step 8: Typecheck, lint, test; then run Prep on a real submission**

Run: `npx tsc --noEmit && npm run lint && npm test`

Manual: in the browser console on `localhost:3000/admin` (signed in as the admin):

```js
const t = await firebase_auth_user.getIdToken()   // or copy from the Network tab's Authorization header
await (await fetch("/api/admin/sample/run/prep", { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: "<uid>/<submissionId>" }) })).json()
```

Expected: `stages.prep.state === "done"`, `assets` has `voice-sample.wav` and `face-1..5.jpg` URLs that open in a new tab.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json next.config.ts lib/studio/sample/ffmpeg.ts lib/studio/sample/ffmpeg.test.ts lib/studio/sample/stages.ts app/api/admin/sample/run
git commit -m "Run sample stages from /api/admin/sample/run; add Prep (voice sample and face frames)"
```

---

### Task 6: Script stage (GPT-6 Sol with canada.ca search)

**Files:**
- Create: `lib/studio/sample/script.ts`, `lib/studio/sample/script.test.ts`
- Modify: `lib/studio/sample/stages.ts` (register `script`), `app/api/admin/sample/script/route.ts` (validate on save), `package.json` (dep `openai`)

**Interfaces:**
- Produces:
  ```ts
  export type ScriptLine = { tts_text: string; caption_text: string }
  export type ScriptCard = { line: number; label: string; value: string; sub: string | null }
  export type Script = { headline: string; published: string; lines: ScriptLine[]; cards: ScriptCard[]; sources: { url: string; title: string }[]; facts: { claim: string; source_url: string }[]; estimated_seconds: number }
  export type ScriptFile = { draft: Script; approved: boolean; model: string; createdAt: string; editedAt?: string; notes?: string; searchSources: string[] }
  export const SCRIPT_MODEL = "gpt-6-sol"
  export const SCRIPT_SYSTEM_PROMPT: string
  export const SCRIPT_JSON_SCHEMA: Record<string, unknown>
  export function scriptUserPrompt(input: { topic: string; ownTopic?: string; today: string; notes?: string }): string
  export function validateScript(value: unknown): { ok: true; script: Script } | { ok: false; errors: string[] }
  export function scriptWords(script: Script): number
  export function stripTags(text: string): string
  export async function generateScript(input: Parameters<typeof scriptUserPrompt>[0]): Promise<{ script: Script; searchSources: string[] }>
  ```

- [ ] **Step 1: Install the SDK**

```bash
npm i openai
```

- [ ] **Step 2: Write failing tests**

`lib/studio/sample/script.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { SCRIPT_SYSTEM_PROMPT, scriptUserPrompt, scriptWords, stripTags, validateScript, type Script } from "@/lib/studio/sample/script"

const good: Script = {
  headline: "Express Entry draw invites 1,000 healthcare workers",
  published: "2026-10-07",
  lines: [
    { tts_text: "[confident] I-R-C-C just ran a new Express Entry draw, and it is aimed at healthcare.", caption_text: "IRCC just ran a new Express Entry draw, and it is aimed at healthcare." },
    { tts_text: "On October seventh, one thousand invitations went out to healthcare and social services workers.", caption_text: "On October 7, 1,000 invitations went out to healthcare and social services workers." },
    { tts_text: "The cut-off score was four hundred and sixty two.", caption_text: "The cut-off score was 462." },
    { tts_text: "If you work in healthcare and your profile is ready, this is the category to watch.", caption_text: "If you work in healthcare and your profile is ready, this is the category to watch." },
    { tts_text: "Not sure where your score sits? Talk to a licensed professional before you act.", caption_text: "Not sure where your score sits? Talk to a licensed professional before you act." },
    { tts_text: "I post a short update like this every week, so follow along for the next one.", caption_text: "I post a short update like this every week, so follow along for the next one." },
  ],
  cards: [
    { line: 1, label: "Invitations", value: "1,000", sub: "Healthcare & social services" },
    { line: 2, label: "CRS cut-off", value: "462", sub: null },
  ],
  sources: [{ url: "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-rounds.html", title: "Express Entry rounds of invitations" }],
  facts: [{ claim: "1,000 ITAs on October 7", source_url: "https://www.canada.ca/en/immigration-refugees-citizenship/x.html" }],
  estimated_seconds: 25,
}

describe("validateScript", () => {
  it("accepts a well-formed script", () => {
    const r = validateScript(good)
    expect(r.ok).toBe(true)
  })
  it("rejects captions with tags, long values, non-canada.ca sources, bad card lines", () => {
    const bad = {
      ...good,
      lines: [{ tts_text: "[warm] hi", caption_text: "[warm] hi" }, ...good.lines.slice(1)],
      cards: [{ line: 9, label: "x".repeat(29), value: "1,000,000,000,000", sub: null }],
      sources: [{ url: "https://cicnews.com/x", title: "t" }],
    }
    const r = validateScript(bad)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.join("\n")).toMatch(/caption.*tag/i)
      expect(r.errors.join("\n")).toMatch(/value.*12/i)
      expect(r.errors.join("\n")).toMatch(/label.*28/i)
      expect(r.errors.join("\n")).toMatch(/card.*line/i)
      expect(r.errors.join("\n")).toMatch(/canada\.ca/)
    }
  })
  it("rejects scripts far outside the word budget", () => {
    const r = validateScript({ ...good, lines: good.lines.slice(0, 1) })
    expect(r.ok).toBe(false)
  })
  it("rejects garbage", () => {
    expect(validateScript(null).ok).toBe(false)
    expect(validateScript({ lines: "x" }).ok).toBe(false)
  })
})

describe("helpers", () => {
  it("counts spoken words without tags", () => {
    expect(stripTags("[confident] I-R-C-C just ran")).toBe("I-R-C-C just ran")
    expect(scriptWords(good)).toBeGreaterThan(60)
  })
  it("puts the rules in the prompts", () => {
    expect(SCRIPT_SYSTEM_PROMPT).toContain("I-R-C-C")
    expect(SCRIPT_SYSTEM_PROMPT).toContain("65 to 85 words")
    expect(SCRIPT_SYSTEM_PROMPT).toContain("canada.ca")
    const u = scriptUserPrompt({ topic: "Study permits", today: "2026-10-09", notes: "use the cap numbers" })
    expect(u).toContain("Study permits")
    expect(u).toContain("2026-10-09")
    expect(u).toContain("use the cap numbers")
  })
})
```

- [ ] **Step 3: Run, expect failure**

Run: `npm test -- lib/studio/sample/script.test.ts`

- [ ] **Step 4: Create `lib/studio/sample/script.ts`**

```ts
import OpenAI from "openai"

export type ScriptLine = { tts_text: string; caption_text: string }
export type ScriptCard = { line: number; label: string; value: string; sub: string | null }
export type Script = {
  headline: string
  published: string
  lines: ScriptLine[]
  cards: ScriptCard[]
  sources: { url: string; title: string }[]
  facts: { claim: string; source_url: string }[]
  estimated_seconds: number
}
export type ScriptFile = {
  draft: Script
  approved: boolean
  model: string
  createdAt: string
  editedAt?: string
  notes?: string
  searchSources: string[]
}

export const SCRIPT_MODEL = "gpt-6-sol"

// The rules the landing samples were made under, written down once.
export const SCRIPT_SYSTEM_PROMPT = `You write 25-second vertical news shorts for licensed Canadian immigration consultants. The consultant appears on camera (AI-generated with their written consent) and speaks your script in their own cloned voice. Viewers are prospective immigrants and their families; they want to know what changed and what to do.

Rules
- 65 to 85 words total. Read aloud at a brisk news pace that is 22 to 28 seconds.
- Shape: one-line hook stating the change in plain words → what exactly changed (numbers, dates, who is affected) → what it means or one action to take → one-line sign-off inviting viewers to follow for next week's update.
- First person, straight to camera, plain English, short sentences. No greeting, no self-introduction, no firm name, no jargon, no legal advice beyond "check with a licensed professional".
- Every number, date, program name and quote must appear on a canada.ca page you actually read in this session. Do not round, convert, infer or carry over from memory. If a figure is not on the page, leave it out.
- Write the acronym as "I-R-C-C" in tts_text and "IRCC" in caption_text. Spell out other acronyms the first time.
- tts_text may use at most two ElevenLabs delivery tags in the whole script, chosen from [confident] [serious] [warm] [pause], placed at the start of a line. caption_text never contains tags and matches the spoken words exactly, with numbers written as digits.
- Cards: 2 to 4 facts worth seeing on screen (a number, a date, a group of people). value is at most 12 characters and must stand on one line; label is at most 28 characters; sub is optional, at most 40. Each card points at the index of the line during which it should appear.
- Return JSON only.`

export function scriptUserPrompt(input: { topic: string; ownTopic?: string; today: string; notes?: string }): string {
  return `Topic area: ${input.topic}
Consultant's own topic, if any: ${input.ownTopic || "none"}
Today: ${input.today}
Admin notes: ${input.notes || "none"}

Search canada.ca for the most recent official IRCC / Government of Canada change or announcement in this area. Prefer the last 14 days; otherwise the most recent you can find. Read the page(s), then write the script.`
}

export const SCRIPT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "published", "lines", "cards", "sources", "facts", "estimated_seconds"],
  properties: {
    headline: { type: "string" },
    published: { type: "string" },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tts_text", "caption_text"],
        properties: { tts_text: { type: "string" }, caption_text: { type: "string" } },
      },
    },
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["line", "label", "value", "sub"],
        properties: {
          line: { type: "integer" },
          label: { type: "string" },
          value: { type: "string" },
          sub: { type: ["string", "null"] },
        },
      },
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["url", "title"],
        properties: { url: { type: "string" }, title: { type: "string" } },
      },
    },
    facts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "source_url"],
        properties: { claim: { type: "string" }, source_url: { type: "string" } },
      },
    },
    estimated_seconds: { type: "number" },
  },
} as const

export function stripTags(text: string): string {
  return text.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim()
}

const words = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0)

export function scriptWords(script: Script): number {
  return script.lines.reduce((n, l) => n + words(stripTags(l.tts_text)), 0)
}

export function validateScript(value: unknown): { ok: true; script: Script } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const s = value as Script | null
  if (!s || typeof s !== "object" || !Array.isArray(s.lines) || !Array.isArray(s.cards) || !Array.isArray(s.sources)) {
    return { ok: false, errors: ["Script is not an object with lines, cards and sources."] }
  }
  if (typeof s.headline !== "string" || !s.headline.trim()) errors.push("headline is empty")
  if (s.lines.length < 3 || s.lines.length > 14) errors.push(`expected 3–14 lines, got ${s.lines.length}`)
  s.lines.forEach((l, i) => {
    if (!l || typeof l.tts_text !== "string" || !l.tts_text.trim()) errors.push(`line ${i}: tts_text is empty`)
    if (!l || typeof l.caption_text !== "string" || !l.caption_text.trim()) errors.push(`line ${i}: caption_text is empty`)
    else if (/\[[^\]]*\]/.test(l.caption_text)) errors.push(`line ${i}: caption_text contains a tag`)
  })
  const total = scriptWords(s)
  if (total < 50 || total > 100) errors.push(`script has ${total} words; aim for 65–85`)
  if (s.cards.length > 4) errors.push("more than 4 cards")
  s.cards.forEach((c, i) => {
    if (!c || !Number.isInteger(c.line) || c.line < 0 || c.line >= s.lines.length) errors.push(`card ${i}: line index out of range`)
    if (!c || typeof c.value !== "string" || !c.value.trim() || c.value.length > 12) errors.push(`card ${i}: value must be 1–12 characters`)
    if (!c || typeof c.label !== "string" || !c.label.trim() || c.label.length > 28) errors.push(`card ${i}: label must be 1–28 characters`)
    if (c && c.sub != null && (typeof c.sub !== "string" || c.sub.length > 40)) errors.push(`card ${i}: sub must be at most 40 characters`)
  })
  if (!s.sources.length) errors.push("no sources")
  s.sources.forEach((src, i) => {
    let host = ""
    try {
      host = new URL(src.url).hostname
    } catch {}
    if (!(host === "canada.ca" || host.endsWith(".canada.ca"))) errors.push(`source ${i}: not on canada.ca (${src.url})`)
  })
  return errors.length ? { ok: false, errors } : { ok: true, script: s }
}

// One Responses API call: search canada.ca, read, write. Structured output
// guarantees the shape; validateScript enforces our rules on top.
export async function generateScript(
  input: Parameters<typeof scriptUserPrompt>[0],
): Promise<{ script: Script; searchSources: string[] }> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.create({
    model: SCRIPT_MODEL,
    instructions: SCRIPT_SYSTEM_PROMPT,
    input: scriptUserPrompt(input),
    reasoning: { effort: "medium" },
    tools: [{ type: "web_search", filters: { allowed_domains: ["canada.ca"] } } as never],
    include: ["web_search_call.action.sources" as never],
    text: { format: { type: "json_schema", name: "script", schema: SCRIPT_JSON_SCHEMA as unknown as Record<string, unknown>, strict: true } },
  })
  const searchSources = response.output
    .filter((item) => item.type === "web_search_call")
    .flatMap((item) => ((item as { action?: { sources?: { url: string }[] } }).action?.sources ?? []).map((s) => s.url))
  const parsed = validateScript(JSON.parse(response.output_text))
  if (!parsed.ok) throw new Error(`Script failed our checks: ${parsed.errors.join("; ")}`)
  return { script: parsed.script, searchSources: Array.from(new Set(searchSources)) }
}
```

If the SDK's types already accept `filters`/`include`, drop the `as never` casts.

- [ ] **Step 5: Register the stage in `stages.ts`**

```ts
import { PRICES } from "@/lib/studio/sample/costs"
import { generateScript, type ScriptFile } from "@/lib/studio/sample/script"
import { OWN_TOPIC_ID, TOPICS } from "@/lib/studio/content"
import { storageJson } from "@/lib/studio/storage"

type RequestJson = { topicId?: string; topicTitle?: string }

const script: StageWork = async ({ token, ref, body }) => {
  const request = await storageJson<RequestJson>(token, `${ref.folder}/request.json`).catch(() => ({}) as RequestJson)
  const topic = TOPICS.find((t) => t.id === request.topicId)
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 500) : undefined
  const { script, searchSources } = await generateScript({
    topic: topic?.detail ?? request.topicTitle ?? "Canadian immigration",
    ownTopic: request.topicId === OWN_TOPIC_ID ? request.topicTitle : undefined,
    today: new Date().toISOString().slice(0, 10),
    notes,
  })
  const file: ScriptFile = { draft: script, approved: false, model: SCRIPT_MODEL, createdAt: new Date().toISOString(), notes, searchSources }
  await storageUpload(token, sampleFile(ref, "script.json"), JSON.stringify(file, null, 2), "application/json")
  return { done: true, cost: PRICES.scriptCall }
}

export const STAGE_WORK: Partial<Record<Stage, StageWork>> = { prep, script }
```

(import `SCRIPT_MODEL` too.) Check `OWN_TOPIC_ID`/`TOPICS` are exported from `lib/studio/content.ts` — they are.

- [ ] **Step 6: Validate on save in `app/api/admin/sample/script/route.ts`**

After the body check add:

```ts
import { validateScript } from "@/lib/studio/sample/script"
…
const checked = validateScript(body.draft)
if (!checked.ok) return Response.json({ error: checked.errors.join(" · ") }, { status: 400 })
```

and store `checked.script` as `draft`. Replace the local `ScriptFile` type with the import from `script.ts`.

- [ ] **Step 7: Copy the OpenAI key and run the stage for real**

```bash
grep '^OPENAI_API_KEY=' ../visaflo-worktrees/main/Backend/.env >> .env.local
curl -s https://api.openai.com/v1/models -H "Authorization: Bearer $(grep '^OPENAI_API_KEY=' .env.local | cut -d= -f2-)" | grep -o '"gpt-6-sol[^"]*"' | sort -u
```
Expected: `"gpt-6-sol"` appears (if not, change `SCRIPT_MODEL` to the id that does).

Then `npm test && npx tsc --noEmit && npm run lint`, restart `npm run dev`, and run `POST /api/admin/sample/run/script` the same way as Prep. Open `script.json` from the console; check the sources are canada.ca pages and the facts are on them.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json lib/studio/sample/script.ts lib/studio/sample/script.test.ts lib/studio/sample/stages.ts app/api/admin/sample/script/route.ts
git commit -m "Write the sample script with GPT-6 Sol from canada.ca"
```

---

### Task 7: Voice stage (ElevenLabs clone + TTS with word timings)

**Files:**
- Create: `lib/studio/sample/words.ts`, `lib/studio/sample/words.test.ts`, `lib/studio/sample/elevenlabs.ts`, `lib/studio/sample/elevenlabs.test.ts`
- Modify: `lib/studio/sample/stages.ts` (register `voice`)

**Interfaces:**
- Produces (words.ts):
  ```ts
  export type Alignment = { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }
  export type Word = { word: string; start: number; end: number; line: number }
  export function wordsFromAlignment(alignment: Alignment, lines: ScriptLine[]): Word[]
  ```
- Produces (elevenlabs.ts):
  ```ts
  export const TTS_MODELS = ["eleven_v4", "eleven_v3", "eleven_multilingual_v2"]
  export async function createVoice(opts: { name: string; description: string; sample: Uint8Array; filename: string }): Promise<string>
  export async function synthesize(voiceId: string, text: string): Promise<{ audio: Uint8Array; alignment: Alignment; modelId: string }>
  export async function composeMusic(prompt: string, lengthMs: number): Promise<Uint8Array>
  export async function soundEffect(text: string, durationSeconds: number): Promise<Uint8Array>
  export function elevenHeaders(): Record<string, string>
  ```
- Files written by the stage: `speech.mp3`, `words.json` (`Word[]`); status patch `voiceId`, `speechSeconds`, `assets`.

- [ ] **Step 1: Write the failing words test**

`lib/studio/sample/words.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { wordsFromAlignment, type Alignment } from "@/lib/studio/sample/words"

// Builds an alignment where every character takes 0.1 s.
function align(text: string): Alignment {
  const characters = Array.from(text)
  return {
    characters,
    character_start_times_seconds: characters.map((_, i) => i * 0.1),
    character_end_times_seconds: characters.map((_, i) => (i + 1) * 0.1),
  }
}

describe("wordsFromAlignment", () => {
  it("maps words to caption text and lines when counts match", () => {
    const lines = [
      { tts_text: "[confident] I-R-C-C ran a draw.", caption_text: "IRCC ran a draw." },
      { tts_text: "Score was high.", caption_text: "Score was high." },
    ]
    const words = wordsFromAlignment(align("[confident] I-R-C-C ran a draw.\n\nScore was high."), lines)
    expect(words.map((w) => w.word)).toEqual(["IRCC", "ran", "a", "draw.", "Score", "was", "high."])
    expect(words.map((w) => w.line)).toEqual([0, 0, 0, 0, 1, 1, 1])
    // "[confident] " is 12 chars → I-R-C-C starts at 1.2 s
    expect(words[0].start).toBeCloseTo(1.2, 5)
    expect(words[0].end).toBeCloseTo(1.9, 5)
    for (let i = 1; i < words.length; i++) expect(words[i].start).toBeGreaterThanOrEqual(words[i - 1].end - 1e-9)
  })

  it("spreads caption words over the line's time when counts differ", () => {
    const lines = [{ tts_text: "twenty five percent", caption_text: "25%" }, { tts_text: "ok", caption_text: "ok" }]
    const words = wordsFromAlignment(align("twenty five percent\n\nok"), lines)
    expect(words.map((w) => w.word)).toEqual(["25%", "ok"])
    expect(words[0].start).toBeCloseTo(0, 5)
    expect(words[0].end).toBeCloseTo(1.9, 5) // end of "percent"
    expect(words[1].line).toBe(1)
  })

  it("survives a tts line with more words than the alignment has left", () => {
    const lines = [{ tts_text: "a b c d", caption_text: "a b c d" }]
    const words = wordsFromAlignment(align("a b"), lines)
    expect(words).toHaveLength(4)
    expect(words.every((w) => Number.isFinite(w.start) && Number.isFinite(w.end))).toBe(true)
  })
})
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- lib/studio/sample/words.test.ts`

- [ ] **Step 3: Create `lib/studio/sample/words.ts`**

```ts
import { stripTags, type ScriptLine } from "@/lib/studio/sample/script"

export type Alignment = {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

export type Word = { word: string; start: number; end: number; line: number }

type Token = { text: string; start: number; end: number }

function tokens(alignment: Alignment): Token[] {
  const out: Token[] = []
  let current: Token | null = null
  alignment.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (current) out.push(current)
      current = null
      return
    }
    const start = alignment.character_start_times_seconds[i]
    const end = alignment.character_end_times_seconds[i]
    if (current) {
      current.text += ch
      current.end = end
    } else current = { text: ch, start, end }
  })
  if (current) out.push(current)
  // Delivery tags like [confident] are spoken as nothing; drop them.
  return out.filter((t) => !/^\[[^\]]*\]$/.test(t.text))
}

// Caption words with the times ElevenLabs gave the spoken words. The TTS text
// and caption text differ only by tags, "I-R-C-C" and digits, so most lines map
// one to one; when they don't, caption words share the line's time evenly.
export function wordsFromAlignment(alignment: Alignment, lines: ScriptLine[]): Word[] {
  const all = tokens(alignment)
  const out: Word[] = []
  let cursor = 0
  lines.forEach((line, lineIndex) => {
    const spoken = stripTags(line.tts_text).split(/\s+/).filter(Boolean)
    const captions = line.caption_text.trim().split(/\s+/).filter(Boolean)
    const mine = all.slice(cursor, cursor + spoken.length)
    cursor += spoken.length
    const fallbackStart = mine[0]?.start ?? out[out.length - 1]?.end ?? 0
    const fallbackEnd = mine[mine.length - 1]?.end ?? fallbackStart + 0.4 * captions.length
    if (mine.length === captions.length && mine.length > 0) {
      captions.forEach((word, i) => out.push({ word, start: mine[i].start, end: mine[i].end, line: lineIndex }))
      return
    }
    const span = Math.max(fallbackEnd - fallbackStart, 0.1)
    captions.forEach((word, i) => {
      const a = fallbackStart + (span * i) / captions.length
      const b = fallbackStart + (span * (i + 1)) / captions.length
      out.push({ word, start: a, end: b, line: lineIndex })
    })
  })
  return out
}
```

- [ ] **Step 4: Write the failing ElevenLabs test (mocked fetch)**

`lib/studio/sample/elevenlabs.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"

import { synthesize, TTS_MODELS } from "@/lib/studio/sample/elevenlabs"

const b64 = Buffer.from([1, 2, 3]).toString("base64")
const alignment = { characters: ["h", "i"], character_start_times_seconds: [0, 0.1], character_end_times_seconds: [0.1, 0.2] }

afterEach(() => vi.unstubAllGlobals())

describe("synthesize", () => {
  it("sends the v4 request with our voice settings and decodes the audio", async () => {
    process.env.ELEVENLABS_API_KEY = "k"
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ audio_base64: b64, alignment }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const r = await synthesize("v1", "hi")
    expect(Array.from(r.audio)).toEqual([1, 2, 3])
    expect(r.modelId).toBe("eleven_v4")
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.elevenlabs.io/v1/text-to-speech/v1/with-timestamps?output_format=mp3_44100_128")
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("k")
    const body = JSON.parse(init.body as string)
    expect(body.model_id).toBe("eleven_v4")
    expect(body.voice_settings).toEqual({ stability: 0.5, similarity_boost: 0.8, style: 0.2, speed: 1.05, use_speaker_boost: true })
    expect(body.apply_text_normalization).toBe("on")
  })

  it("falls back to the next model when one rejects the model id", async () => {
    process.env.ELEVENLABS_API_KEY = "k"
    let calls = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls++
        if (calls === 1) return new Response(JSON.stringify({ detail: { status: "model_not_found" } }), { status: 400 })
        return new Response(JSON.stringify({ audio_base64: b64, alignment }), { status: 200 })
      }),
    )
    const r = await synthesize("v1", "hi")
    expect(r.modelId).toBe(TTS_MODELS[1])
  })

  it("surfaces other errors", async () => {
    process.env.ELEVENLABS_API_KEY = "k"
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota", { status: 402 })))
    await expect(synthesize("v1", "hi")).rejects.toThrow(/402/)
  })
})
```

- [ ] **Step 5: Create `lib/studio/sample/elevenlabs.ts`**

```ts
import type { Alignment } from "@/lib/studio/sample/words"

const BASE = "https://api.elevenlabs.io/v1"

export function elevenHeaders(): Record<string, string> {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set")
  return { "xi-api-key": key }
}

async function fail(response: Response, what: string): Promise<never> {
  throw new Error(`ElevenLabs ${what} responded ${response.status}: ${(await response.text()).slice(0, 300)}`)
}

// Instant Voice Clone from the minute of reading we extracted; one per person.
export async function createVoice(opts: { name: string; description: string; sample: Uint8Array; filename: string }): Promise<string> {
  const form = new FormData()
  form.set("name", opts.name)
  form.set("description", opts.description)
  form.set("remove_background_noise", "true")
  form.set("labels", JSON.stringify({ use_case: "news" }))
  form.append("files", new Blob([opts.sample], { type: "audio/wav" }), opts.filename)
  const response = await fetch(`${BASE}/voices/add`, { method: "POST", headers: elevenHeaders(), body: form })
  if (!response.ok) return fail(response, "voice clone")
  const body = (await response.json()) as { voice_id: string }
  return body.voice_id
}

export const TTS_MODELS = ["eleven_v4", "eleven_v3", "eleven_multilingual_v2"]

const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.8, style: 0.2, speed: 1.05, use_speaker_boost: true }

// Newest model first; an account or endpoint that lacks it says so with a
// 4xx naming the model, and we step down.
export async function synthesize(voiceId: string, text: string): Promise<{ audio: Uint8Array; alignment: Alignment; modelId: string }> {
  let lastError: Error | null = null
  for (const modelId of TTS_MODELS) {
    const response = await fetch(`${BASE}/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { ...elevenHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: modelId, voice_settings: VOICE_SETTINGS, apply_text_normalization: "on" }),
    })
    if (response.ok) {
      const body = (await response.json()) as { audio_base64: string; alignment: Alignment | null; normalized_alignment: Alignment | null }
      const alignment = body.alignment ?? body.normalized_alignment
      if (!alignment) throw new Error("ElevenLabs returned no alignment")
      return { audio: new Uint8Array(Buffer.from(body.audio_base64, "base64")), alignment, modelId }
    }
    const detail = await response.text()
    if (response.status >= 400 && response.status < 500 && /model/i.test(detail)) {
      lastError = new Error(`ElevenLabs rejected ${modelId}: ${detail.slice(0, 200)}`)
      continue
    }
    throw new Error(`ElevenLabs text-to-speech responded ${response.status}: ${detail.slice(0, 300)}`)
  }
  throw lastError ?? new Error("No ElevenLabs model accepted the request")
}

export async function composeMusic(prompt: string, lengthMs: number): Promise<Uint8Array> {
  const response = await fetch(`${BASE}/music?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { ...elevenHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, music_length_ms: Math.round(lengthMs), force_instrumental: true, model_id: "music_v2_5" }),
  })
  if (!response.ok) return fail(response, "music")
  return new Uint8Array(await response.arrayBuffer())
}

export async function soundEffect(text: string, durationSeconds: number): Promise<Uint8Array> {
  const response = await fetch(`${BASE}/sound-generation?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { ...elevenHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ text, duration_seconds: durationSeconds, prompt_influence: 0.6, model_id: "eleven_text_to_sound_v2" }),
  })
  if (!response.ok) return fail(response, "sound effect")
  return new Uint8Array(await response.arrayBuffer())
}
```

- [ ] **Step 6: Run both tests**

Run: `npm test -- lib/studio/sample/words.test.ts lib/studio/sample/elevenlabs.test.ts`
Expected: PASS.

- [ ] **Step 7: Register the Voice stage in `stages.ts`**

```ts
import { ttsCost } from "@/lib/studio/sample/costs"
import { createVoice, synthesize } from "@/lib/studio/sample/elevenlabs"
import { wordsFromAlignment } from "@/lib/studio/sample/words"
import { storageBytes } from "@/lib/studio/storage"

export const MAX_SPEECH_SECONDS = 30

const voice: StageWork = async ({ token, ref, status }) => {
  const file = await storageJson<ScriptFile>(token, sampleFile(ref, "script.json"))
  if (!file.approved) throw new Error("Approve the script first")

  let voiceId = status.voiceId
  if (!voiceId) {
    const sample = await storageBytes(token, sampleFile(ref, "voice-sample.wav"))
    voiceId = await createVoice({
      name: `studio-${ref.uid}`,
      description: "Immigration consultant, webcam recording, studio.visaflo.ca",
      sample,
      filename: "voice-sample.wav",
    })
  }

  const text = file.draft.lines.map((l) => l.tts_text).join("\n\n")
  const { audio, alignment } = await synthesize(voiceId, text)
  const words = wordsFromAlignment(alignment, file.draft.lines)
  const speechSeconds = Math.round((words[words.length - 1]?.end ?? 0) * 100) / 100
  if (speechSeconds > MAX_SPEECH_SECONDS) {
    throw new Error(`Speech is ${speechSeconds}s; trim the script under ${MAX_SPEECH_SECONDS}s before making video`)
  }
  const assets = {
    "speech.mp3": await uploadAsset(token, ref, "speech.mp3", audio, "audio/mpeg"),
    "words.json": await uploadAsset(token, ref, "words.json", JSON.stringify(words), "application/json"),
  }
  return { done: true, cost: ttsCost(text.length), patch: { voiceId, speechSeconds, assets } }
}

export const STAGE_WORK: Partial<Record<Stage, StageWork>> = { prep, script, voice }
```

- [ ] **Step 8: Typecheck, lint, test; real run**

Add `ELEVENLABS_API_KEY=` to `.env.local`. Approve the script with `PUT /api/admin/sample/script` (`{ id, draft, approved: true }` using the draft from `script.json`), then `POST /api/admin/sample/run/voice`. Listen to `assets["speech.mp3"]`: the clone, "IRCC" spelled out, under 30 s. Note how much of the accent survives — that goes into the A/B comparison.

- [ ] **Step 9: Commit**

```bash
git add lib/studio/sample/words.ts lib/studio/sample/words.test.ts lib/studio/sample/elevenlabs.ts lib/studio/sample/elevenlabs.test.ts lib/studio/sample/stages.ts
git commit -m "Clone the voice and speak the script with word timings"
```

---

### Task 8: Video stage (fal lipsync / OmniHuman, Higgsfield Seedance) and the poll route

**Files:**
- Create: `lib/studio/sample/prompts.ts`, `lib/studio/sample/fal.ts`, `lib/studio/sample/higgsfield.ts`, `lib/studio/sample/providers.test.ts`, `lib/studio/sample/poll.ts`, `lib/studio/sample/poll.test.ts`, `app/api/admin/sample/poll/route.ts`
- Modify: `lib/studio/sample/stages.ts` (register `video`)

**Interfaces:**
- Produces (prompts.ts):
  ```ts
  export const BACKGROUND_PROMPT: Record<Background, string>
  export function scenePrompt(background: Background): string
  export const OMNIHUMAN_PROMPT: string
  export const MUSIC_PROMPT: Record<"calm" | "energetic", string>
  export const SFX: { name: "sfx-whoosh" | "sfx-pop"; text: string; seconds: number }[]
  ```
- Produces (fal.ts / higgsfield.ts):
  ```ts
  export type JobPoll = { state: "running" } | { state: "done"; videoUrl: string } | { state: "failed"; error: string }
  export const LIPSYNC_MODEL = "fal-ai/sync-lipsync/v2/pro"
  export const OMNIHUMAN_MODEL = "fal-ai/bytedance/omnihuman/v1.5"
  export async function submitFal(model: string, input: Record<string, unknown>): Promise<StageJob>   // provider "fal"
  export async function pollFal(job: StageJob): Promise<JobPoll>
  export async function submitSeedance(input: { imageUrl: string; audioUrl: string; prompt: string; duration: number }): Promise<StageJob>  // provider "higgsfield"
  export async function pollHiggsfield(job: StageJob): Promise<JobPoll>
  ```
- Produces (poll.ts):
  ```ts
  export async function pollJob(ctx: { token: string; ref: SampleRef; status: SampleStatus; now?: Date }): Promise<SampleStatus>
  ```
  Finds the one stage in `running` with a `job`, asks its provider, and returns the updated status (done / still running / failed / timed out). Task 11 extends it for `remotion` and `local`.

- [ ] **Step 1: Create `lib/studio/sample/prompts.ts`** (text only, no test)

```ts
import type { Background } from "@/lib/studio/sample/status"

// Every prompt the pipeline sends to a generation model, in one place, so the
// spec and the code say the same thing.

export const BACKGROUND_PROMPT: Record<Background, string> = {
  office: "a bright modern office with large windows and soft daylight, blurred",
  studio: "a clean neutral studio with a soft warm-grey gradient backdrop",
  street: "a downtown Canadian street at golden hour, softly blurred",
}

export function scenePrompt(background: Background): string {
  return `The person from the reference image, an immigration consultant, speaks directly to the camera like a confident, friendly news presenter, following the reference audio. Medium close-up, head and shoulders, centred, generous headroom so the top third of the frame stays empty for on-screen cards. Natural small hand gestures, steady locked-off camera, soft even key light, shallow depth of field. Background: ${BACKGROUND_PROMPT[background]}. Keep the person's face, hair, skin tone and glasses exactly as in the reference. No on-screen text, no captions, no logos, no other people, no camera movement.`
}

export const OMNIHUMAN_PROMPT =
  "The person speaks to camera as a calm, confident news presenter, natural subtle hand gestures, steady framing, no camera movement, no text on screen."

export const MUSIC_PROMPT = {
  calm: "Understated modern news-brief underscore: soft electric piano chords, light brushed percussion, subtle synth pulse, steady medium tempo around 95 BPM, trustworthy and optimistic, instrumental only, leaves space for a speaking voice, clean ending.",
  energetic:
    "Bright modern news-brief underscore: crisp electronic drums, plucked synth motif, warm bass, around 115 BPM, confident and forward-moving, instrumental only, leaves space for a speaking voice, clean ending.",
}

export const SFX = [
  { name: "sfx-whoosh", text: "short soft whoosh with a subtle click, clean UI transition, no reverb", seconds: 0.7 },
  { name: "sfx-pop", text: "gentle single pop, notification tick, soft, dry", seconds: 0.5 },
] as const
```

- [ ] **Step 2: Write the failing provider tests**

`lib/studio/sample/providers.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"

import { LIPSYNC_MODEL, pollFal, submitFal } from "@/lib/studio/sample/fal"
import { pollHiggsfield, submitSeedance } from "@/lib/studio/sample/higgsfield"

afterEach(() => vi.unstubAllGlobals())

describe("fal", () => {
  it("submits to the queue and keeps the status and response urls", async () => {
    process.env.FAL_KEY = "fk"
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ request_id: "r1", status_url: "https://q/s", response_url: "https://q/r" }), { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)
    const job = await submitFal(LIPSYNC_MODEL, { video_url: "v", audio_url: "a", sync_mode: "cut_off" })
    expect(job).toEqual({ provider: "fal", id: "r1", statusUrl: "https://q/s", responseUrl: "https://q/r" })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://queue.fal.run/fal-ai/sync-lipsync/v2/pro")
    expect((init.headers as Record<string, string>).Authorization).toBe("Key fk")
    expect(JSON.parse(init.body as string)).toEqual({ video_url: "v", audio_url: "a", sync_mode: "cut_off" })
  })

  it("polls: in progress, completed with video url, failed", async () => {
    process.env.FAL_KEY = "fk"
    const job = { provider: "fal" as const, id: "r1", statusUrl: "https://q/s", responseUrl: "https://q/r" }
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "IN_PROGRESS" }))))
    expect(await pollFal(job)).toEqual({ state: "running" })
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "https://q/s"
          ? new Response(JSON.stringify({ status: "COMPLETED" }))
          : new Response(JSON.stringify({ video: { url: "https://out/v.mp4" } })),
      ),
    )
    expect(await pollFal(job)).toEqual({ state: "done", videoUrl: "https://out/v.mp4" })
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "FAILED", error: "bad audio" }), { status: 200 })))
    expect(await pollFal(job)).toMatchObject({ state: "failed" })
  })
})

describe("higgsfield", () => {
  it("submits Seedance 2.5 with our fixed settings", async () => {
    process.env.HIGGSFIELD_KEY_ID = "id"
    process.env.HIGGSFIELD_KEY_SECRET = "sec"
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ request_id: "h1", status_url: "https://h/s", cancel_url: "https://h/c" }), { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)
    const job = await submitSeedance({ imageUrl: "i", audioUrl: "a", prompt: "p", duration: 27 })
    expect(job).toEqual({ provider: "higgsfield", id: "h1", statusUrl: "https://h/s", step: "scene" })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.higgsfield.ai/bytedance/seedance-2.5/reference-to-video")
    expect((init.headers as Record<string, string>).Authorization).toBe("Key id:sec")
    expect(JSON.parse(init.body as string)).toEqual({
      prompt: "p",
      image_urls: ["i"],
      audio_urls: ["a"],
      duration: 27,
      resolution: "720p",
      aspect_ratio: "9:16",
      bitrate_mode: "standard",
      generate_audio: true,
    })
  })

  it("polls Higgsfield statuses", async () => {
    process.env.HIGGSFIELD_KEY_ID = "id"
    process.env.HIGGSFIELD_KEY_SECRET = "sec"
    const job = { provider: "higgsfield" as const, id: "h1", statusUrl: "https://h/s", step: "scene" as const }
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "in_progress" }))))
    expect(await pollHiggsfield(job)).toEqual({ state: "running" })
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "completed", video: { url: "https://h/v.mp4" } }))))
    expect(await pollHiggsfield(job)).toEqual({ state: "done", videoUrl: "https://h/v.mp4" })
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "failed", error: "nsfw" }))))
    expect(await pollHiggsfield(job)).toMatchObject({ state: "failed" })
  })
})
```

- [ ] **Step 3: Run, expect failure**

Run: `npm test -- lib/studio/sample/providers.test.ts`

- [ ] **Step 4: Create `lib/studio/sample/fal.ts`**

```ts
import type { StageJob } from "@/lib/studio/sample/status"

export type JobPoll = { state: "running" } | { state: "done"; videoUrl: string } | { state: "failed"; error: string }

export const LIPSYNC_MODEL = "fal-ai/sync-lipsync/v2/pro"
export const OMNIHUMAN_MODEL = "fal-ai/bytedance/omnihuman/v1.5"

function headers(): Record<string, string> {
  const key = process.env.FAL_KEY
  if (!key) throw new Error("FAL_KEY is not set")
  return { Authorization: `Key ${key}`, "Content-Type": "application/json" }
}

// fal's queue: submit, then read status_url until COMPLETED, then response_url.
export async function submitFal(model: string, input: Record<string, unknown>): Promise<StageJob> {
  const response = await fetch(`https://queue.fal.run/${model}`, { method: "POST", headers: headers(), body: JSON.stringify(input) })
  if (!response.ok) throw new Error(`fal ${model} responded ${response.status}: ${(await response.text()).slice(0, 300)}`)
  const body = (await response.json()) as { request_id: string; status_url: string; response_url: string }
  return { provider: "fal", id: body.request_id, statusUrl: body.status_url, responseUrl: body.response_url }
}

export async function pollFal(job: StageJob): Promise<JobPoll> {
  if (!job.statusUrl || !job.responseUrl) return { state: "failed", error: "fal job lost its urls" }
  const status = await fetch(job.statusUrl, { headers: headers(), cache: "no-store" })
  if (!status.ok) return { state: "failed", error: `fal status ${status.status}: ${(await status.text()).slice(0, 200)}` }
  const body = (await status.json()) as { status: string; error?: string }
  if (body.status === "IN_QUEUE" || body.status === "IN_PROGRESS") return { state: "running" }
  if (body.status !== "COMPLETED") return { state: "failed", error: `fal ${body.status}: ${body.error ?? ""}`.trim() }
  const result = await fetch(job.responseUrl, { headers: headers(), cache: "no-store" })
  if (!result.ok) return { state: "failed", error: `fal result ${result.status}: ${(await result.text()).slice(0, 200)}` }
  const out = (await result.json()) as { video?: { url?: string } }
  return out.video?.url ? { state: "done", videoUrl: out.video.url } : { state: "failed", error: "fal returned no video" }
}
```

- [ ] **Step 5: Create `lib/studio/sample/higgsfield.ts`**

```ts
import type { JobPoll } from "@/lib/studio/sample/fal"
import type { StageJob } from "@/lib/studio/sample/status"

function headers(): Record<string, string> {
  const id = process.env.HIGGSFIELD_KEY_ID
  const secret = process.env.HIGGSFIELD_KEY_SECRET
  if (!id || !secret) throw new Error("HIGGSFIELD_KEY_ID / HIGGSFIELD_KEY_SECRET are not set")
  return { Authorization: `Key ${id}:${secret}`, "Content-Type": "application/json" }
}

// Seedance 2.5 reference-to-video: the face frame fixes the person, the speech
// gives the mouth a rhythm. Its own audio is thrown away after lipsync.
export async function submitSeedance(input: { imageUrl: string; audioUrl: string; prompt: string; duration: number }): Promise<StageJob> {
  const response = await fetch("https://api.higgsfield.ai/bytedance/seedance-2.5/reference-to-video", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      prompt: input.prompt,
      image_urls: [input.imageUrl],
      audio_urls: [input.audioUrl],
      duration: input.duration,
      resolution: "720p",
      aspect_ratio: "9:16",
      bitrate_mode: "standard",
      generate_audio: true,
    }),
  })
  if (!response.ok) throw new Error(`Higgsfield responded ${response.status}: ${(await response.text()).slice(0, 300)}`)
  const body = (await response.json()) as { request_id: string; status_url: string }
  return { provider: "higgsfield", id: body.request_id, statusUrl: body.status_url, step: "scene" }
}

export async function pollHiggsfield(job: StageJob): Promise<JobPoll> {
  if (!job.statusUrl) return { state: "failed", error: "Higgsfield job lost its status url" }
  const response = await fetch(job.statusUrl, { headers: headers(), cache: "no-store" })
  if (!response.ok) return { state: "failed", error: `Higgsfield status ${response.status}: ${(await response.text()).slice(0, 200)}` }
  const body = (await response.json()) as { status: string; error?: string; video?: { url?: string } }
  const status = body.status.toLowerCase()
  if (status === "queued" || status === "in_progress" || status === "processing" || status === "in_queue") return { state: "running" }
  if (status !== "completed") return { state: "failed", error: `Higgsfield ${status}: ${body.error ?? ""}`.trim() }
  return body.video?.url ? { state: "done", videoUrl: body.video.url } : { state: "failed", error: "Higgsfield returned no video" }
}
```

- [ ] **Step 6: Run the provider tests** — `npm test -- lib/studio/sample/providers.test.ts` → PASS.

- [ ] **Step 7: Register the Video stage in `stages.ts`**

```ts
import { cutClip } from "@/lib/studio/sample/ffmpeg"
import { LIPSYNC_MODEL, OMNIHUMAN_MODEL, submitFal } from "@/lib/studio/sample/fal"
import { submitSeedance } from "@/lib/studio/sample/higgsfield"
import { OMNIHUMAN_PROMPT, scenePrompt } from "@/lib/studio/sample/prompts"

export function clipSeconds(speechSeconds: number): number {
  return Math.min(30, Math.ceil(speechSeconds) + 1)
}

const video: StageWork = async ({ token, ref, status }) => {
  const speechUrl = status.assets["speech.mp3"]
  if (!speechUrl || !status.speechSeconds) throw new Error("Run Voice first")
  const seconds = clipSeconds(status.speechSeconds)
  const { method, faceFrame, clipStart, layout, background } = status.options

  if (method === "real") {
    const dir = await tmpDir()
    const { file, seconds: recorded } = await downloadRecording(token, ref, dir)
    const start = Math.max(0, Math.min(clipStart, recorded - seconds))
    const clip = path.join(dir, "clip.mp4")
    await cutClip(file, clip, { start, seconds, crop: layout === "full" })
    const clipUrl = await uploadAsset(token, ref, "clip.mp4", await readFile(clip), "video/mp4")
    const job = await submitFal(LIPSYNC_MODEL, { video_url: clipUrl, audio_url: speechUrl, sync_mode: "cut_off" })
    return { done: false, job: { ...job, step: "lipsync" } }
  }

  const faceUrl = status.assets[`face-${faceFrame}.jpg`]
  if (!faceUrl) throw new Error("Pick a face frame first")
  if (method === "scene") {
    return { done: false, job: await submitSeedance({ imageUrl: faceUrl, audioUrl: speechUrl, prompt: scenePrompt(background), duration: seconds }) }
  }
  const job = await submitFal(OMNIHUMAN_MODEL, { image_url: faceUrl, audio_url: speechUrl, resolution: "720p", prompt: OMNIHUMAN_PROMPT })
  return { done: false, job }
}

export const STAGE_WORK: Partial<Record<Stage, StageWork>> = { prep, script, voice, video }
```

- [ ] **Step 8: Write the failing poll test**

`lib/studio/sample/poll.test.ts` — exercises the state machine around providers with mocked provider functions:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"

import * as fal from "@/lib/studio/sample/fal"
import * as higgsfield from "@/lib/studio/sample/higgsfield"
import { pollJob } from "@/lib/studio/sample/poll"
import * as stages from "@/lib/studio/sample/stages"
import { defaultStatus, setJob, startStage } from "@/lib/studio/sample/status"

const ref = { uid: "u", submissionId: "s", folder: "studio/u/s", sampleFolder: "studio/u/s/sample" }
const falJob = { provider: "fal" as const, id: "r", statusUrl: "s", responseUrl: "r", step: "lipsync" as const }

afterEach(() => vi.restoreAllMocks())

describe("pollJob", () => {
  it("leaves a running job alone", async () => {
    vi.spyOn(fal, "pollFal").mockResolvedValue({ state: "running" })
    const status = setJob(startStage(defaultStatus(), "video"), "video", falJob)
    const next = await pollJob({ token: "t", ref, status })
    expect(next.stages.video.state).toBe("running")
  })

  it("copies a finished lipsync into talking.mp4 and prices it", async () => {
    vi.spyOn(fal, "pollFal").mockResolvedValue({ state: "done", videoUrl: "https://out/v.mp4" })
    const copy = vi.spyOn(stages, "copyToSample").mockResolvedValue("https://bucket/talking.mp4")
    const status = { ...setJob(startStage(defaultStatus(), "video"), "video", falJob), speechSeconds: 25 }
    const next = await pollJob({ token: "t", ref, status })
    expect(copy).toHaveBeenCalledWith("t", ref, "https://out/v.mp4", "talking.mp4", "video/mp4")
    expect(next.stages.video.state).toBe("done")
    expect(next.assets["talking.mp4"]).toBe("https://bucket/talking.mp4")
    expect(next.stages.video.cost).toBeCloseTo(2.17, 2)
  })

  it("chains Seedance into lipsync", async () => {
    vi.spyOn(higgsfield, "pollHiggsfield").mockResolvedValue({ state: "done", videoUrl: "https://h/scene.mp4" })
    vi.spyOn(stages, "copyToSample").mockResolvedValue("https://bucket/scene.mp4")
    const submit = vi.spyOn(fal, "submitFal").mockResolvedValue({ provider: "fal", id: "r2", statusUrl: "s2", responseUrl: "r2" })
    const base = { ...defaultStatus(), speechSeconds: 25, assets: { "speech.mp3": "https://bucket/speech.mp3" } }
    const status = setJob(startStage(base, "video"), "video", { provider: "higgsfield", id: "h", statusUrl: "hs", step: "scene" })
    const next = await pollJob({ token: "t", ref, status })
    expect(submit).toHaveBeenCalledWith(fal.LIPSYNC_MODEL, { video_url: "https://bucket/scene.mp4", audio_url: "https://bucket/speech.mp3", sync_mode: "cut_off" })
    expect(next.stages.video.state).toBe("running")
    expect(next.stages.video.job).toMatchObject({ provider: "fal", id: "r2", step: "lipsync" })
    expect(next.assets["scene.mp4"]).toBe("https://bucket/scene.mp4")
  })

  it("fails the stage when the provider fails", async () => {
    vi.spyOn(fal, "pollFal").mockResolvedValue({ state: "failed", error: "bad audio" })
    const status = setJob(startStage(defaultStatus(), "video"), "video", falJob)
    const next = await pollJob({ token: "t", ref, status })
    expect(next.stages.video).toMatchObject({ state: "failed", error: expect.stringContaining("bad audio") })
  })

  it("times out a job that never finishes", async () => {
    vi.spyOn(fal, "pollFal").mockResolvedValue({ state: "running" })
    const started = new Date("2026-10-09T10:00:00Z")
    const status = setJob(startStage(defaultStatus(), "video", started), "video", falJob)
    const next = await pollJob({ token: "t", ref, status, now: new Date("2026-10-09T10:20:00Z") })
    expect(next.stages.video).toMatchObject({ state: "failed", error: expect.stringContaining("timed out") })
  })

  it("does nothing when nothing is running", async () => {
    const status = defaultStatus()
    expect(await pollJob({ token: "t", ref, status })).toEqual(status)
  })
})
```

- [ ] **Step 9: Add `copyToSample` to `stages.ts` and create `poll.ts`**

In `stages.ts`:

```ts
// Providers keep outputs for a limited time; copy them into our folder.
export async function copyToSample(token: string, ref: SampleRef, url: string, name: string, contentType: string): Promise<string> {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) throw new Error(`Could not download ${name} from the provider (${response.status})`)
  return uploadAsset(token, ref, name, new Uint8Array(await response.arrayBuffer()), contentType)
}
```

`lib/studio/sample/poll.ts`:

```ts
import type { SampleRef } from "@/lib/studio/sample/context"
import { videoCost } from "@/lib/studio/sample/costs"
import { LIPSYNC_MODEL, pollFal, submitFal, type JobPoll } from "@/lib/studio/sample/fal"
import { pollHiggsfield } from "@/lib/studio/sample/higgsfield"
import { clipSeconds, copyToSample } from "@/lib/studio/sample/stages"
import { failStage, finishStage, setJob, STAGES, timedOut, type SampleStatus, type Stage, type StageJob } from "@/lib/studio/sample/status"

export type PollContext = { token: string; ref: SampleRef; status: SampleStatus; now?: Date }

async function askProvider(job: StageJob): Promise<JobPoll> {
  if (job.provider === "fal") return pollFal(job)
  if (job.provider === "higgsfield") return pollHiggsfield(job)
  return { state: "failed", error: `No poller for ${job.provider}` }
}

async function finishVideo(ctx: PollContext, job: StageJob, videoUrl: string): Promise<SampleStatus> {
  const { token, ref, status } = ctx
  if (job.step === "scene") {
    // Seedance is done; now fit the mouth to the real speech.
    const sceneUrl = await copyToSample(token, ref, videoUrl, "scene.mp4", "video/mp4")
    const speechUrl = status.assets["speech.mp3"]
    const next = await submitFal(LIPSYNC_MODEL, { video_url: sceneUrl, audio_url: speechUrl, sync_mode: "cut_off" })
    return setJob({ ...status, assets: { ...status.assets, "scene.mp4": sceneUrl } }, "video", { ...next, step: "lipsync" })
  }
  const talkingUrl = await copyToSample(token, ref, videoUrl, "talking.mp4", "video/mp4")
  const seconds = clipSeconds(status.speechSeconds ?? 25)
  return finishStage(status, "video", { cost: videoCost(status.options.method, seconds), assets: { "talking.mp4": talkingUrl } })
}

// Called every few seconds by the admin page while something is running.
export async function pollJob(ctx: PollContext): Promise<SampleStatus> {
  const { status } = ctx
  const now = ctx.now ?? new Date()
  const stage = STAGES.find((s) => status.stages[s].state === "running" && status.stages[s].job) as Stage | undefined
  if (!stage) return status
  const state = status.stages[stage]
  if (timedOut(state, now, stage)) return failStage(status, stage, "The job timed out; run the stage again.", now)

  let result: JobPoll
  try {
    result = await askProvider(state.job!)
  } catch (error) {
    return failStage(status, stage, error instanceof Error ? error.message : String(error), now)
  }
  if (result.state === "running") return status
  if (result.state === "failed") return failStage(status, stage, result.error, now)
  try {
    if (stage === "video") return await finishVideo(ctx, state.job!, result.videoUrl)
    return failStage(status, stage, `No finisher for ${stage}`, now)
  } catch (error) {
    return failStage(status, stage, error instanceof Error ? error.message : String(error), now)
  }
}
```

(Task 11 adds the `remotion`/`local` branches and a `finishRender`.)

- [ ] **Step 10: Create `app/api/admin/sample/poll/route.ts`**

```ts
import { openSample, storageFailure, writeStatus } from "@/lib/studio/sample/context"
import { pollJob } from "@/lib/studio/sample/poll"

export const maxDuration = 300

export async function GET(request: Request) {
  const sample = await openSample(request)
  if (sample instanceof Response) return sample
  const next = await pollJob({ token: sample.token, ref: sample.ref, status: sample.status })
  if (next !== sample.status) {
    try {
      await writeStatus(sample.token, sample.ref, next)
    } catch (error) {
      return storageFailure(error) ?? Response.json({ error: "We couldn't save the sample status." }, { status: 500 })
    }
  }
  return Response.json(next)
}
```

- [ ] **Step 11: Test, typecheck, lint; real run of method A**

`npm test && npx tsc --noEmit && npm run lint`. Add `FAL_KEY` (and for B, `HIGGSFIELD_KEY_ID/SECRET`) to `.env.local`. `PUT options` `{ id, options: { method: "real" } }`, `POST run/video`, then `GET poll?id=…` every few seconds until `stages.video.state` is `done`. Open `assets["talking.mp4"]`.

- [ ] **Step 12: Commit**

```bash
git add lib/studio/sample/prompts.ts lib/studio/sample/fal.ts lib/studio/sample/higgsfield.ts lib/studio/sample/providers.test.ts lib/studio/sample/poll.ts lib/studio/sample/poll.test.ts lib/studio/sample/stages.ts app/api/admin/sample/poll
git commit -m "Make the talking video: real footage, Seedance scene or OmniHuman, lip-synced to the speech"
```

---

### Task 9: Audio stage (music + sound effects)

**Files:**
- Modify: `lib/studio/sample/stages.ts` (register `audio`), `lib/studio/sample/elevenlabs.test.ts` (add music/sfx request-shape tests)

- [ ] **Step 1: Add failing tests to `elevenlabs.test.ts`**

```ts
import { composeMusic, soundEffect } from "@/lib/studio/sample/elevenlabs"

describe("music and sfx", () => {
  it("asks for instrumental music of the right length", async () => {
    process.env.ELEVENLABS_API_KEY = "k"
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([9]), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    expect(Array.from(await composeMusic("p", 28_000))).toEqual([9])
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128")
    expect(JSON.parse(init.body as string)).toEqual({ prompt: "p", music_length_ms: 28000, force_instrumental: true, model_id: "music_v2_5" })
  })
  it("asks for a short sound effect", async () => {
    process.env.ELEVENLABS_API_KEY = "k"
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([7]), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    await soundEffect("whoosh", 0.7)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({ text: "whoosh", duration_seconds: 0.7, prompt_influence: 0.6, model_id: "eleven_text_to_sound_v2" })
  })
})
```

Run: `npm test -- lib/studio/sample/elevenlabs.test.ts` → PASS already (the functions exist from Task 7); if any assertion fails, fix the function, not the test.

- [ ] **Step 2: Register the Audio stage**

```ts
import { audioCost } from "@/lib/studio/sample/costs"
import { composeMusic, soundEffect } from "@/lib/studio/sample/elevenlabs"
import { MUSIC_PROMPT, SFX } from "@/lib/studio/sample/prompts"

const audio: StageWork = async ({ token, ref, status }) => {
  if (!status.speechSeconds) throw new Error("Run Voice first")
  const assets: Record<string, string> = {}
  const music = await composeMusic(MUSIC_PROMPT[status.options.mood], (status.speechSeconds + 3) * 1000)
  assets["music.mp3"] = await uploadAsset(token, ref, "music.mp3", music, "audio/mpeg")
  for (const sfx of SFX) {
    assets[`${sfx.name}.mp3`] = await uploadAsset(token, ref, `${sfx.name}.mp3`, await soundEffect(sfx.text, sfx.seconds), "audio/mpeg")
  }
  return { done: true, cost: audioCost(status.speechSeconds), patch: { assets } }
}

export const STAGE_WORK: Partial<Record<Stage, StageWork>> = { prep, script, voice, video, audio }
```

- [ ] **Step 3: Typecheck, lint, run it** — `POST run/audio`; listen to `music.mp3` (instrumental, ~speech+3 s) and both SFX.

- [ ] **Step 4: Commit**

```bash
git add lib/studio/sample/stages.ts lib/studio/sample/elevenlabs.test.ts
git commit -m "Generate the sample's music and sound effects"
```

---

### Task 10: Remotion composition (captions, cards, mix) with fixtures

**Files:**
- Create: `remotion.config.ts`, `remotion/index.ts`, `remotion/Root.tsx`, `remotion/types.ts`, `remotion/captions.ts`, `remotion/captions.test.ts`, `remotion/Sample.tsx`, `remotion/Captions.tsx`, `remotion/Cards.tsx`, `remotion/fixtures/props.json`, `scripts/make-fixtures.sh`
- Modify: `package.json` (deps + scripts), `.gitignore` (fixture media), `tsconfig.json` (exclude nothing; Remotion files are plain TSX)

**Interfaces:**
- Produces (`remotion/types.ts` — a copy of the server shapes so the Remotion bundle has no `@/` imports):
  ```ts
  export type Word = { word: string; start: number; end: number; line: number }
  export type Card = { line: number; label: string; value: string; sub: string | null }
  export type SampleProps = { talkingUrl: string; speechUrl: string; musicUrl: string; sfxWhooshUrl: string; sfxPopUrl: string; words: Word[]; cards: Card[]; layout: "boxed" | "full"; headline: string; speechSeconds: number }
  export const FPS = 30, WIDTH = 1080, HEIGHT = 1920, TAIL_SECONDS = 1.5
  export function durationInFrames(speechSeconds: number): number
  ```
- Produces (`remotion/captions.ts`): `export type Group = { start: number; end: number; words: Word[] }`, `export function groupWords(words: Word[], maxWords = 4): Group[]`
- Composition id: `"Sample"`. Task 11 renders it with `SampleProps` as input props.

- [ ] **Step 1: Install Remotion**

```bash
npm i remotion @remotion/cli @remotion/renderer @remotion/bundler @remotion/lambda
```

All five must be the same version (`npm ls remotion` shows one). Add scripts:

```json
"remotion:studio": "remotion studio remotion/index.ts",
"remotion:fixtures": "sh scripts/make-fixtures.sh",
"sample:render": "tsx scripts/render-sample.ts"
```

`remotion.config.ts` at the repo root:

```ts
import { Config } from "@remotion/cli/config"

// Fixture media for the Studio preview lives with the composition, not in
// Next's public/ folder.
Config.setPublicDir("remotion/fixtures")
Config.setVideoImageFormat("jpeg")
Config.setOverwriteOutput(true)
```

Add to `.gitignore`:

```
remotion/fixtures/*.mp4
remotion/fixtures/*.mp3
```

- [ ] **Step 2: Write the failing caption-grouping test**

`remotion/captions.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { groupWords } from "./captions"

const w = (word: string, start: number, line = 0) => ({ word, start, end: start + 0.3, line })

describe("groupWords", () => {
  it("makes groups of up to four words", () => {
    const words = ["a", "b", "c", "d", "e", "f"].map((t, i) => w(t, i * 0.4))
    const groups = groupWords(words)
    expect(groups.map((g) => g.words.map((x) => x.word))).toEqual([["a", "b", "c", "d"], ["e", "f"]])
    expect(groups[0].start).toBe(0)
    expect(groups[0].end).toBe(groups[1].start)
    expect(groups[1].end).toBeCloseTo(2.0 + 0.3)
  })
  it("breaks at line boundaries and long pauses", () => {
    const words = [w("a", 0), w("b", 0.4), w("c", 0.8, 1), w("d", 1.2, 1), w("e", 3.0, 1)]
    const groups = groupWords(words)
    expect(groups.map((g) => g.words.map((x) => x.word))).toEqual([["a", "b"], ["c", "d"], ["e"]])
  })
  it("returns nothing for no words", () => {
    expect(groupWords([])).toEqual([])
  })
})
```

- [ ] **Step 3: Run, expect failure** — `npm test -- remotion/captions.test.ts`

- [ ] **Step 4: Create `remotion/types.ts` and `remotion/captions.ts`**

```ts
// remotion/types.ts
export type Word = { word: string; start: number; end: number; line: number }
export type Card = { line: number; label: string; value: string; sub: string | null }

export type SampleProps = {
  talkingUrl: string
  speechUrl: string
  musicUrl: string
  sfxWhooshUrl: string
  sfxPopUrl: string
  words: Word[]
  cards: Card[]
  layout: "boxed" | "full"
  headline: string
  speechSeconds: number
}

export const FPS = 30
export const WIDTH = 1080
export const HEIGHT = 1920
export const TAIL_SECONDS = 1.5

export function durationInFrames(speechSeconds: number): number {
  return Math.ceil((speechSeconds + TAIL_SECONDS) * FPS)
}
```

```ts
// remotion/captions.ts
import type { Word } from "./types"

export type Group = { start: number; end: number; words: Word[] }

// Karaoke groups: a few words at a time, never across a script line, and a
// new group after a pause so the caption doesn't sit there during silence.
export function groupWords(words: Word[], maxWords = 4, maxGap = 0.8): Group[] {
  const groups: Group[] = []
  let current: Word[] = []
  const flush = () => {
    if (current.length) groups.push({ start: current[0].start, end: current[current.length - 1].end, words: current })
    current = []
  }
  words.forEach((word, i) => {
    const prev = words[i - 1]
    if (prev && (current.length >= maxWords || word.line !== prev.line || word.start - prev.end > maxGap)) flush()
    current.push(word)
  })
  flush()
  // A group stays on screen until the next one starts.
  for (let i = 0; i < groups.length - 1; i++) groups[i].end = groups[i + 1].start
  return groups
}
```

Run the test → PASS.

- [ ] **Step 5: Composition files**

`remotion/index.ts`:

```ts
import { registerRoot } from "remotion"

import { RemotionRoot } from "./Root"

registerRoot(RemotionRoot)
```

`remotion/Root.tsx`:

```tsx
import { Composition, staticFile } from "remotion"

import fixture from "./fixtures/props.json"
import { Sample } from "./Sample"
import { durationInFrames, FPS, HEIGHT, WIDTH, type SampleProps } from "./types"

// Fixture props point at the media scripts/make-fixtures.sh synthesises.
const defaultProps: SampleProps = {
  ...(fixture as Omit<SampleProps, "talkingUrl" | "speechUrl" | "musicUrl" | "sfxWhooshUrl" | "sfxPopUrl">),
  talkingUrl: staticFile("talking.mp4"),
  speechUrl: staticFile("speech.mp3"),
  musicUrl: staticFile("music.mp3"),
  sfxWhooshUrl: staticFile("sfx-whoosh.mp3"),
  sfxPopUrl: staticFile("sfx-pop.mp3"),
}

export function RemotionRoot() {
  return (
    <Composition
      id="Sample"
      component={Sample}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={durationInFrames(defaultProps.speechSeconds)}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => ({ durationInFrames: durationInFrames(props.speechSeconds) })}
    />
  )
}
```

`remotion/Sample.tsx`:

```tsx
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from "remotion"

import { Captions } from "./Captions"
import { Cards } from "./Cards"
import { FPS, type SampleProps } from "./types"

const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif"

// Music sits under the voice and drops a little further while a word is
// being spoken, so the speech always reads clearly.
function musicVolume(props: SampleProps, frame: number, total: number): number {
  const t = frame / FPS
  const speaking = props.words.some((w) => t >= w.start && t <= w.end)
  const base = speaking ? 0.1 : 0.16
  const fadeIn = Math.min(1, t / 1)
  const fadeOut = Math.min(1, Math.max(0, (total / FPS - t) / 1.5))
  return base * fadeIn * fadeOut
}

export function Sample(props: SampleProps) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const boxed = props.layout === "boxed"
  const showHeadline = frame < 2.5 * FPS

  return (
    <AbsoluteFill style={{ backgroundColor: "#0c0a09", fontFamily: FONT, color: "white" }}>
      {boxed ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ width: 1000, height: 562, borderRadius: 28, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>
            <OffthreadVideo src={props.talkingUrl} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </AbsoluteFill>
      ) : (
        <OffthreadVideo src={props.talkingUrl} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      )}

      <Audio src={props.speechUrl} />
      <Audio src={props.musicUrl} volume={(f) => musicVolume(props, f, durationInFrames)} />

      {showHeadline && (
        <div
          style={{
            position: "absolute",
            top: boxed ? 160 : 120,
            left: 60,
            right: 60,
            fontSize: 44,
            fontWeight: 600,
            lineHeight: 1.2,
            opacity: Math.min(1, frame / 8) * Math.min(1, (2.5 * FPS - frame) / 8),
          }}
        >
          {props.headline}
        </div>
      )}

      <Cards cards={props.cards} words={props.words} layout={props.layout} sfxWhoosh={props.sfxWhooshUrl} sfxPop={props.sfxPopUrl} />
      <Sequence from={0}>
        <Captions words={props.words} layout={props.layout} />
      </Sequence>
    </AbsoluteFill>
  )
}
```

`remotion/Captions.tsx`:

```tsx
import { useCurrentFrame } from "remotion"

import { groupWords } from "./captions"
import { FPS, type Word } from "./types"

// Lower-third karaoke captions: the current group in white, the spoken word
// highlighted. 120 px safe margin above the bottom for platform UI.
export function Captions({ words, layout }: { words: Word[]; layout: "boxed" | "full" }) {
  const t = useCurrentFrame() / FPS
  const group = groupWords(words).find((g) => t >= g.start && t < g.end)
  if (!group) return null
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        bottom: layout === "boxed" ? 420 : 300,
        textAlign: "center",
        fontSize: 64,
        fontWeight: 700,
        lineHeight: 1.15,
        textShadow: "0 4px 24px rgba(0,0,0,0.8)",
      }}
    >
      {group.words.map((w, i) => {
        const active = t >= w.start && t <= w.end + 0.05
        return (
          <span key={i} style={{ color: active ? "#fbbf24" : "white", marginRight: 18, display: "inline-block", transform: active ? "scale(1.06)" : "none" }}>
            {w.word}
          </span>
        )
      })}
    </div>
  )
}
```

`remotion/Cards.tsx`:

```tsx
import { Audio, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion"

import { FPS, type Card, type Word } from "./types"

type Timed = Card & { at: number }

// A card appears on the first word of its line and stays. Up to three stack
// in the top band, each built label → value → sub so nothing is ever an
// empty box. Values shrink to stay on one line.
function schedule(cards: Card[], words: Word[]): Timed[] {
  return cards
    .map((c) => ({ ...c, at: words.find((w) => w.line === c.line)?.start ?? 0 }))
    .sort((a, b) => a.at - b.at)
    .slice(0, 3)
}

function valueSize(value: string): number {
  if (value.length <= 5) return 96
  if (value.length <= 8) return 76
  return 58
}

export function Cards(props: { cards: Card[]; words: Word[]; layout: "boxed" | "full"; sfxWhoosh: string; sfxPop: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const timed = schedule(props.cards, props.words)
  const visible = timed.filter((c) => frame >= c.at * FPS)
  const top = props.layout === "boxed" ? 240 : 150
  return (
    <>
      {timed.map((c, i) => (
        <Sequence key={`sfx-${i}`} from={Math.round(c.at * FPS)} durationInFrames={FPS}>
          <Audio src={i === 0 ? props.sfxWhoosh : props.sfxPop} volume={0.6} />
        </Sequence>
      ))}
      <div style={{ position: "absolute", top, left: 60, right: 60, display: "flex", flexDirection: "column", gap: 20 }}>
        {visible.map((c, i) => {
          const local = frame - Math.round(c.at * FPS)
          const enter = spring({ frame: local, fps, config: { damping: 18, stiffness: 160 } })
          const valueIn = Math.min(1, Math.max(0, (local - 4) / 8))
          const subIn = Math.min(1, Math.max(0, (local - 10) / 8))
          return (
            <div
              key={i}
              style={{
                transform: `translateY(${(1 - enter) * -40}px)`,
                opacity: enter,
                background: "rgba(255,255,255,0.94)",
                color: "#0c0a09",
                borderRadius: 24,
                padding: "26px 34px",
                boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
              }}
            >
              <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: "#57534e" }}>{c.label}</div>
              <div style={{ fontSize: valueSize(c.value), fontWeight: 800, lineHeight: 1.05, whiteSpace: "nowrap", opacity: valueIn }}>{c.value}</div>
              {c.sub && <div style={{ fontSize: 30, color: "#44403c", marginTop: 6, opacity: subIn }}>{c.sub}</div>}
            </div>
          )
        })}
      </div>
    </>
  )
}
```

- [ ] **Step 6: Fixtures**

`scripts/make-fixtures.sh`:

```sh
#!/bin/sh
# Synthetic media so `npm run remotion:studio` has something to play.
set -e
cd "$(dirname "$0")/.."
FF=./node_modules/ffmpeg-static/ffmpeg
OUT=remotion/fixtures
$FF -y -f lavfi -i "testsrc2=duration=26:size=720x1280:rate=30" -pix_fmt yuv420p -c:v libx264 -crf 30 "$OUT/talking.mp4"
$FF -y -f lavfi -i "sine=frequency=220:duration=25" -c:a libmp3lame -q:a 6 "$OUT/speech.mp3"
$FF -y -f lavfi -i "sine=frequency=110:duration=28" -af "volume=0.3" -c:a libmp3lame -q:a 6 "$OUT/music.mp3"
$FF -y -f lavfi -i "sine=frequency=880:duration=0.7" -af "afade=t=out:st=0.2:d=0.5" -c:a libmp3lame "$OUT/sfx-whoosh.mp3"
$FF -y -f lavfi -i "sine=frequency=1320:duration=0.5" -af "afade=t=out:st=0.1:d=0.4" -c:a libmp3lame "$OUT/sfx-pop.mp3"
echo "fixtures written to $OUT"
```

`remotion/fixtures/props.json` — the six-line script from Task 6's test, words spread evenly over 25 s. Generate once with this snippet (node) and commit the output:

```js
const lines = [
  "IRCC just ran a new Express Entry draw, and it is aimed at healthcare.",
  "On October 7, 1,000 invitations went out to healthcare and social services workers.",
  "The cut-off score was 462.",
  "If you work in healthcare and your profile is ready, this is the category to watch.",
  "Not sure where your score sits? Talk to a licensed professional before you act.",
  "I post a short update like this every week, so follow along for the next one.",
]
const all = lines.flatMap((l, line) => l.split(" ").map((word) => ({ word, line })))
const step = 25 / all.length
const words = all.map((w, i) => ({ ...w, start: +(i * step).toFixed(2), end: +((i + 1) * step - 0.05).toFixed(2) }))
console.log(JSON.stringify({
  words,
  cards: [
    { line: 1, label: "Invitations", value: "1,000", sub: "Healthcare & social services" },
    { line: 2, label: "CRS cut-off", value: "462", sub: null },
  ],
  layout: "boxed",
  headline: "Express Entry draw invites 1,000 healthcare workers",
  speechSeconds: 25,
}, null, 2))
```

- [ ] **Step 7: Look at it**

```bash
npm run remotion:fixtures
npm run remotion:studio
```

In the Studio: scrub the "Sample" composition. Check: captions change in groups, the active word is amber, cards slide in on their line's first word with the SFX, values stay on one line, nothing overlaps the video box. Toggle `layout` to `full` in the props panel and check the top band (cards) never covers the centre of the frame.

Then `npx tsc --noEmit && npm run lint` (if ESLint complains about Remotion's inline styles or `<img>`, there are none; fix anything real).

- [ ] **Step 8: Commit**

```bash
git add remotion.config.ts remotion scripts/make-fixtures.sh package.json package-lock.json .gitignore
git commit -m "Compose the sample video in Remotion: karaoke captions, fact cards, music under the voice"
```

---

### Task 11: Render stage — Remotion Lambda with a local fallback

**Files:**
- Create: `lib/studio/sample/render.ts`, `lib/studio/sample/render.test.ts`, `scripts/render-sample.ts`
- Modify: `lib/studio/sample/stages.ts` (register `render`), `lib/studio/sample/poll.ts` (finish `remotion` / `local` jobs)

**Interfaces:**
- Produces (render.ts):
  ```ts
  export type RenderProps = SampleProps (from remotion/types) — built on the server
  export function renderProps(status: SampleStatus, script: Script, words: Word[]): RenderProps
  export function lambdaConfigured(): boolean          // REMOTION_FUNCTION_NAME && REMOTION_SERVE_URL && REMOTION_REGION
  export async function startLambdaRender(props: RenderProps): Promise<StageJob>   // provider "remotion", id = renderId, bucketName
  export async function pollLambdaRender(job: StageJob): Promise<JobPoll>
  ```
- Server imports `remotion/types` by relative path (`@/remotion/types`) — types only.

- [ ] **Step 1: Write the failing test**

`lib/studio/sample/render.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { renderProps } from "@/lib/studio/sample/render"
import { defaultStatus } from "@/lib/studio/sample/status"

describe("renderProps", () => {
  it("collects every asset url and the script parts the composition needs", () => {
    const status = {
      ...defaultStatus(),
      speechSeconds: 24.5,
      assets: {
        "talking.mp4": "t",
        "speech.mp3": "s",
        "music.mp3": "m",
        "sfx-whoosh.mp3": "w",
        "sfx-pop.mp3": "p",
      },
    }
    const script = { headline: "H", cards: [{ line: 0, label: "L", value: "V", sub: null }] } as never
    const words = [{ word: "a", start: 0, end: 0.3, line: 0 }]
    expect(renderProps(status, script, words)).toEqual({
      talkingUrl: "t",
      speechUrl: "s",
      musicUrl: "m",
      sfxWhooshUrl: "w",
      sfxPopUrl: "p",
      words,
      cards: [{ line: 0, label: "L", value: "V", sub: null }],
      layout: "boxed",
      headline: "H",
      speechSeconds: 24.5,
    })
  })
  it("refuses when an asset is missing", () => {
    expect(() => renderProps({ ...defaultStatus(), speechSeconds: 20 }, { headline: "H", cards: [] } as never, [])).toThrow(/talking\.mp4/)
  })
})
```

- [ ] **Step 2: Run, expect failure** — `npm test -- lib/studio/sample/render.test.ts`

- [ ] **Step 3: Create `lib/studio/sample/render.ts`**

```ts
import { getRenderProgress, renderMediaOnLambda, type AwsRegion } from "@remotion/lambda/client"

import type { SampleProps } from "@/remotion/types"
import type { JobPoll } from "@/lib/studio/sample/fal"
import type { Script } from "@/lib/studio/sample/script"
import type { SampleStatus, StageJob } from "@/lib/studio/sample/status"
import type { Word } from "@/lib/studio/sample/words"

const ASSETS = ["talking.mp4", "speech.mp3", "music.mp3", "sfx-whoosh.mp3", "sfx-pop.mp3"] as const

export function renderProps(status: SampleStatus, script: Script, words: Word[]): SampleProps {
  for (const name of ASSETS) if (!status.assets[name]) throw new Error(`Missing ${name}; run the stage that makes it`)
  if (!status.speechSeconds) throw new Error("Run Voice first")
  return {
    talkingUrl: status.assets["talking.mp4"],
    speechUrl: status.assets["speech.mp3"],
    musicUrl: status.assets["music.mp3"],
    sfxWhooshUrl: status.assets["sfx-whoosh.mp3"],
    sfxPopUrl: status.assets["sfx-pop.mp3"],
    words,
    cards: script.cards,
    layout: status.options.layout,
    headline: script.headline,
    speechSeconds: status.speechSeconds,
  }
}

function lambda() {
  const functionName = process.env.REMOTION_FUNCTION_NAME
  const serveUrl = process.env.REMOTION_SERVE_URL
  const region = process.env.REMOTION_REGION as AwsRegion | undefined
  return functionName && serveUrl && region ? { functionName, serveUrl, region } : null
}

export function lambdaConfigured(): boolean {
  return lambda() !== null
}

// @remotion/lambda reads REMOTION_AWS_ACCESS_KEY_ID / REMOTION_AWS_SECRET_ACCESS_KEY itself.
export async function startLambdaRender(props: SampleProps): Promise<StageJob> {
  const cfg = lambda()
  if (!cfg) throw new Error("Remotion Lambda is not configured")
  const { renderId, bucketName } = await renderMediaOnLambda({
    ...cfg,
    composition: "Sample",
    inputProps: props,
    codec: "h264",
    privacy: "public",
    downloadBehavior: { type: "play-in-browser" },
  })
  return { provider: "remotion", id: renderId, bucketName }
}

export async function pollLambdaRender(job: StageJob): Promise<JobPoll> {
  const cfg = lambda()
  if (!cfg || !job.bucketName) return { state: "failed", error: "Remotion Lambda is not configured" }
  const progress = await getRenderProgress({ renderId: job.id, bucketName: job.bucketName, functionName: cfg.functionName, region: cfg.region })
  if (progress.fatalErrorEncountered) {
    return { state: "failed", error: `Render failed: ${progress.errors.map((e) => e.message).join("; ").slice(0, 300)}` }
  }
  if (progress.done && progress.outputFile) return { state: "done", videoUrl: progress.outputFile }
  return { state: "running" }
}
```

Run the test → PASS.

- [ ] **Step 4: Register the Render stage and extend the poller**

`stages.ts`:

```ts
import { lambdaConfigured, renderProps, startLambdaRender } from "@/lib/studio/sample/render"
import type { Word } from "@/lib/studio/sample/words"

const render: StageWork = async ({ token, ref, status }) => {
  const file = await storageJson<ScriptFile>(token, sampleFile(ref, "script.json"))
  const words = await storageJson<Word[]>(token, sampleFile(ref, "words.json"))
  const props = renderProps(status, file.draft, words)
  if (lambdaConfigured()) return { done: false, job: await startLambdaRender(props) }
  // No Lambda yet: leave the props for `npm run sample:render`, which uploads
  // final.mp4; the poller notices the file.
  await uploadAsset(token, ref, "render-props.json", JSON.stringify(props), "application/json")
  return { done: false, job: { provider: "local", id: "render-props.json" } }
}

export const STAGE_WORK: Partial<Record<Stage, StageWork>> = { prep, script, voice, video, audio, render }
```

`poll.ts` — in `askProvider` add:

```ts
if (job.provider === "remotion") return pollLambdaRender(job)
if (job.provider === "local") {
  const url = await localFinal(ctxToken, ctxRef)
  return url ? { state: "done", videoUrl: url } : { state: "running" }
}
```

To give `askProvider` the token and ref, change its signature to `askProvider(ctx: PollContext, job: StageJob)`; `localFinal` is:

```ts
import { sampleFile } from "@/lib/studio/sample/context"
import { mediaUrl, storageExists, storageMeta } from "@/lib/studio/storage"

async function localFinal(token: string, ref: SampleRef): Promise<string | null> {
  const name = sampleFile(ref, "final.mp4")
  if (!(await storageExists(token, name))) return null
  const meta = await storageMeta(token, name)
  const dl = meta.downloadTokens?.split(",")[0]
  return dl ? mediaUrl(name, dl) : null
}
```

and the finisher branch:

```ts
if (stage === "render") {
  const finalUrl = state.job!.provider === "local" ? result.videoUrl : await copyToSample(ctx.token, ctx.ref, result.videoUrl, "final.mp4", "video/mp4")
  return finishStage(status, "render", { cost: state.job!.provider === "remotion" ? 0.02 : 0, assets: { "final.mp4": finalUrl } })
}
```

Add a poll test: a `local` job finishes when `final.mp4` exists (spy `storageExists` → true, `storageMeta` → `{ name, downloadTokens: "tok" }`) and stays running when it doesn't.

- [ ] **Step 5: Local render script `scripts/render-sample.ts`**

```ts
// Local fallback for the Render stage: `npm run sample:render -- <uid/submissionId>`
// with STUDIO_ADMIN_TOKEN set (copy it from the admin page). Reads
// render-props.json from the bucket, renders with Chrome here, uploads final.mp4.
import path from "node:path"
import { readFile } from "node:fs/promises"
import { bundle } from "@remotion/bundler"
import { renderMedia, selectComposition } from "@remotion/renderer"

import { parseSampleId, sampleFile } from "../lib/studio/sample/context"
import { storageJson, storageUpload } from "../lib/studio/storage"

async function main() {
  const id = process.argv[2]
  const token = process.env.STUDIO_ADMIN_TOKEN
  const ref = parseSampleId(id)
  if (!ref || !token) throw new Error("usage: STUDIO_ADMIN_TOKEN=… npm run sample:render -- <uid/submissionId>")

  const props = await storageJson<Record<string, unknown>>(token, sampleFile(ref, "render-props.json"))
  const serveUrl = await bundle({ entryPoint: path.resolve("remotion/index.ts"), publicDir: path.resolve("remotion/fixtures") })
  const composition = await selectComposition({ serveUrl, id: "Sample", inputProps: props })
  const out = path.resolve(`out/${ref.uid}-${ref.submissionId}.mp4`)
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: out, inputProps: props, onProgress: (p) => process.stdout.write(`\r${Math.round(p.progress * 100)}%`) })
  await storageUpload(token, sampleFile(ref, "final.mp4"), new Uint8Array(await readFile(out)), "video/mp4")
  console.log(`\nuploaded ${sampleFile(ref, "final.mp4")}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

Add `out/` to `.gitignore`.

- [ ] **Step 6: Lambda setup (once, needs AWS keys for the VisaFlo account)**

```bash
export REMOTION_AWS_ACCESS_KEY_ID=… REMOTION_AWS_SECRET_ACCESS_KEY=…
npx remotion lambda policies user      # paste into an IAM user "remotion-studio"
npx remotion lambda functions deploy --region=us-east-1 --memory=3009 --disk=10240 --timeout=600
npx remotion lambda sites create remotion/index.ts --site-name=visaflo-studio-sample --region=us-east-1
```

Put `REMOTION_FUNCTION_NAME`, `REMOTION_SERVE_URL`, `REMOTION_REGION=us-east-1` and the two AWS keys into `.env.local` and Vercel. If AWS access isn't there yet, skip this and use the local script.

- [ ] **Step 7: Test, typecheck, lint; render one for real**

`npm test && npx tsc --noEmit && npm run lint`. `POST run/render`; with Lambda, poll until `final.mp4` appears; without, run `STUDIO_ADMIN_TOKEN=… npm run sample:render -- <id>`, then poll. Watch `final.mp4` end to end.

- [ ] **Step 8: Commit**

```bash
git add lib/studio/sample/render.ts lib/studio/sample/render.test.ts lib/studio/sample/stages.ts lib/studio/sample/poll.ts lib/studio/sample/poll.test.ts scripts/render-sample.ts .gitignore
git commit -m "Render the final sample with Remotion Lambda, or locally until Lambda is set up"
```

---

### Task 12: The "Make sample" panel in /admin

**Files:**
- Create: `lib/studio/sample/client.ts`, `components/studio/sample-panel.tsx`, `components/studio/script-editor.tsx`
- Modify: `components/studio/admin.tsx` (mount the panel in `SubmissionDetail`), `app/api/admin/sample/script/route.ts` (add `GET`)

**Interfaces:**
- Produces (client.ts):
  ```ts
  export async function sampleApi<T>(user: User, method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T>  // throws Error(message) on !ok
  export const getStatus = (user, id) => sampleApi<SampleStatus>(user, "GET", `status?id=${encodeURIComponent(id)}`)
  export const poll = (user, id) => sampleApi<SampleStatus>(user, "GET", `poll?id=…`)
  export const saveOptions = (user, id, options: Partial<SampleOptions>) => sampleApi<SampleStatus>(user, "PUT", "options", { id, options })
  export const runStage = (user, id, stage: Stage, body?: Record<string, unknown>) => sampleApi<SampleStatus>(user, "POST", `run/${stage}`, { id, ...body })
  export const getScript = (user, id) => sampleApi<ScriptFile | null>(user, "GET", `script?id=…`)
  export const saveScript = (user, id, draft: Script, approved: boolean) => sampleApi<{ status: SampleStatus; script: ScriptFile }>(user, "PUT", "script", { id, draft, approved })
  ```
- Consumes: `Submission` (admin.ts), `useStudioUser` (auth.ts), UI primitives from `components/studio/ui.tsx`.

- [ ] **Step 1: `GET` for the script route**

In `app/api/admin/sample/script/route.ts` add:

```ts
export async function GET(request: Request) {
  const sample = await openSample(request)
  if (sample instanceof Response) return sample
  try {
    return Response.json(await storageJson<ScriptFile>(sample.token, sampleFile(sample.ref, "script.json")))
  } catch (error) {
    if (error instanceof StorageError && error.status === 404) return Response.json(null)
    return storageFailure(error) ?? Response.json({ error: "We couldn't read the script." }, { status: 500 })
  }
}
```

- [ ] **Step 2: `lib/studio/sample/client.ts`**

```ts
"use client"

import type { User } from "firebase/auth"

import type { Script, ScriptFile } from "@/lib/studio/sample/script"
import type { SampleOptions, SampleStatus, Stage } from "@/lib/studio/sample/status"

// The admin page talks to /api/admin/sample/* with a fresh ID token each time.
export async function sampleApi<T>(user: User, method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T> {
  const token = await user.getIdToken()
  const response = await fetch(`/api/admin/sample/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!response.ok) throw new Error(json?.error ?? `Request failed (${response.status})`)
  return json as T
}

const q = (id: string) => `id=${encodeURIComponent(id)}`

export const getStatus = (user: User, id: string) => sampleApi<SampleStatus>(user, "GET", `status?${q(id)}`)
export const poll = (user: User, id: string) => sampleApi<SampleStatus>(user, "GET", `poll?${q(id)}`)
export const saveOptions = (user: User, id: string, options: Partial<SampleOptions>) =>
  sampleApi<SampleStatus>(user, "PUT", "options", { id, options })
export const runStage = (user: User, id: string, stage: Stage, body: Record<string, unknown> = {}) =>
  sampleApi<SampleStatus>(user, "POST", `run/${stage}`, { id, ...body })
export const getScript = (user: User, id: string) => sampleApi<ScriptFile | null>(user, "GET", `script?${q(id)}`)
export const saveScript = (user: User, id: string, draft: Script, approved: boolean) =>
  sampleApi<{ status: SampleStatus; script: ScriptFile }>(user, "PUT", "script", { id, draft, approved })
```

- [ ] **Step 3: `components/studio/script-editor.tsx`**

```tsx
"use client"

import { useState } from "react"

import { ErrorText, SecondaryButton } from "@/components/studio/ui"
import type { Script, ScriptFile } from "@/lib/studio/sample/script"

const input = "h-10 w-full rounded-none border border-stone-950/16 bg-transparent px-3 text-[14px] outline-none focus:border-stone-950"
const area = "min-h-[64px] w-full rounded-none border border-stone-950/16 bg-transparent p-3 text-[14px] leading-[1.4] outline-none focus:border-stone-950"

// Lines, cards and sources side by side with GPT's fact list, so the admin
// can check every number against its page before approving.
export function ScriptEditor({
  file,
  busy,
  onSave,
}: {
  file: ScriptFile
  busy: boolean
  onSave: (draft: Script, approved: boolean) => Promise<void>
}) {
  const [draft, setDraft] = useState<Script>(file.draft)
  const [error, setError] = useState<string | null>(null)
  const words = draft.lines.reduce((n, l) => n + l.tts_text.replace(/\[[^\]]*\]/g, "").trim().split(/\s+/).filter(Boolean).length, 0)

  function setLine(i: number, key: "tts_text" | "caption_text", value: string) {
    setDraft((d) => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, [key]: value } : l)) }))
  }
  function setCard(i: number, patch: Partial<Script["cards"][number]>) {
    setDraft((d) => ({ ...d, cards: d.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))
  }
  async function save(approved: boolean) {
    setError(null)
    try {
      await onSave(draft, approved)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.")
    }
  }

  return (
    <div className="flex flex-col gap-5 border border-stone-200 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <input className={`${input} max-w-[560px] text-[16px] font-medium`} value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} />
        <span className="text-[13px] text-stone-600">
          {words} words · {file.model} · {file.approved ? "approved" : "draft"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {draft.lines.map((l, i) => (
          <div key={i} className="contents">
            <textarea className={area} value={l.tts_text} onChange={(e) => setLine(i, "tts_text", e.target.value)} aria-label={`Line ${i + 1} spoken`} />
            <textarea className={area} value={l.caption_text} onChange={(e) => setLine(i, "caption_text", e.target.value)} aria-label={`Line ${i + 1} caption`} />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium">Cards (line · label · value · sub)</span>
        {draft.cards.map((c, i) => (
          <div key={i} className="grid grid-cols-[56px_1fr_120px_1fr_auto] gap-2">
            <input className={input} type="number" min={0} max={draft.lines.length - 1} value={c.line} onChange={(e) => setCard(i, { line: Number(e.target.value) })} />
            <input className={input} maxLength={28} value={c.label} onChange={(e) => setCard(i, { label: e.target.value })} />
            <input className={input} maxLength={12} value={c.value} onChange={(e) => setCard(i, { value: e.target.value })} />
            <input className={input} maxLength={40} value={c.sub ?? ""} onChange={(e) => setCard(i, { sub: e.target.value || null })} />
            <button type="button" className="text-[13px] text-stone-600 underline" onClick={() => setDraft({ ...draft, cards: draft.cards.filter((_, j) => j !== i) })}>
              remove
            </button>
          </div>
        ))}
        {draft.cards.length < 4 && (
          <button type="button" className="self-start text-[13px] underline" onClick={() => setDraft({ ...draft, cards: [...draft.cards, { line: 0, label: "", value: "", sub: null }] })}>
            add card
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 text-[13px] text-stone-600 lg:grid-cols-2">
        <div>
          <div className="mb-1 font-medium text-stone-950">Sources</div>
          {draft.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block truncate underline">
              {s.title || s.url}
            </a>
          ))}
          {file.searchSources.length > 0 && <div className="mt-1">Searched {file.searchSources.length} canada.ca pages</div>}
        </div>
        <div>
          <div className="mb-1 font-medium text-stone-950">Facts GPT says it checked</div>
          {draft.facts.map((f, i) => (
            <div key={i} className="truncate">
              {f.claim} —{" "}
              <a href={f.source_url} target="_blank" rel="noreferrer" className="underline">
                source
              </a>
            </div>
          ))}
        </div>
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      <div className="flex flex-wrap gap-3">
        <SecondaryButton type="button" className="h-10 px-4 text-[14px]" disabled={busy} onClick={() => void save(false)}>
          Save draft
        </SecondaryButton>
        <SecondaryButton type="button" className="h-10 border-stone-950 px-4 text-[14px]" disabled={busy} onClick={() => void save(true)}>
          {file.approved ? "Save and keep approved" : "Approve for voice"}
        </SecondaryButton>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `components/studio/sample-panel.tsx`**

```tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { User } from "firebase/auth"

import { ScriptEditor } from "@/components/studio/script-editor"
import { ErrorText, MonoLabel, SecondaryButton } from "@/components/studio/ui"
import type { Submission } from "@/lib/studio/admin"
import { useStudioUser } from "@/lib/studio/auth"
import { getScript, getStatus, poll, runStage, saveOptions, saveScript } from "@/lib/studio/sample/client"
import { audioCost, videoCost } from "@/lib/studio/sample/costs"
import type { Script, ScriptFile } from "@/lib/studio/sample/script"
import { blockers, STAGE_LABEL, STAGES, type SampleOptions, type SampleStatus, type Stage } from "@/lib/studio/sample/status"
import { cn } from "@/lib/utils"

const RUNNABLE: Stage[] = ["prep", "script", "voice", "video", "audio", "render"]

const METHOD_HELP: Record<SampleOptions["method"], string> = {
  real: "A · their own recording, lips re-synced (≈ $3)",
  scene: "B · Higgsfield scene from a face frame, lips re-synced (≈ $7)",
  portrait: "C · OmniHuman from a face frame (≈ $5)",
}

function elapsed(s: { startedAt?: string; finishedAt?: string }): string {
  if (!s.startedAt) return ""
  const end = s.finishedAt ? Date.parse(s.finishedAt) : Date.now()
  const sec = Math.max(0, Math.round((end - Date.parse(s.startedAt)) / 1000))
  return sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`
}

export function SamplePanel({ submission }: { submission: Submission }) {
  const user = useStudioUser()
  const id = submission.id
  const [status, setStatus] = useState<SampleStatus | null>(null)
  const [script, setScript] = useState<ScriptFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Stage | "options" | "script" | null>(null)
  const [notes, setNotes] = useState("")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshScript = useCallback(async (u: User) => setScript(await getScript(u, id)), [id])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([getStatus(user, id), getScript(user, id)])
      .then(([s, sc]) => {
        if (cancelled) return
        setStatus(s)
        setScript(sc)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [user, id])

  // While a provider job runs, ask the poll route every 5 s.
  const running = status ? STAGES.some((s) => status.stages[s].state === "running" && status.stages[s].job) : false
  useEffect(() => {
    if (!user || !running) return
    timer.current = setTimeout(() => {
      poll(user, id)
        .then(setStatus)
        .catch((e: Error) => setError(e.message))
    }, 5000)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [user, id, running, status])

  if (!user) return null

  async function act<T>(key: typeof busy, work: () => Promise<T>): Promise<T | undefined> {
    setBusy(key)
    setError(null)
    try {
      return await work()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setBusy(null)
    }
  }

  const options = status?.options
  const setOption = (patch: Partial<SampleOptions>) =>
    void act("options", async () => setStatus(await saveOptions(user, id, patch)))
  const run = (stage: Stage) =>
    void act(stage, async () => {
      const next = await runStage(user, id, stage, stage === "script" && notes ? { notes } : {})
      setStatus(next)
      if (stage === "script") await refreshScript(user)
    })
  const onSaveScript = async (draft: Script, approved: boolean) => {
    const r = await saveScript(user, id, draft, approved)
    setStatus(r.status)
    setScript(r.script)
  }

  if (!status || !options) return <p className="m-0 text-[14px] text-stone-600">{error ?? "Loading sample…"}</p>

  const seconds = Math.min(30, Math.ceil(status.speechSeconds ?? 26) + 1)
  const spent = STAGES.reduce((n, s) => n + (status.stages[s].cost ?? 0), 0)

  return (
    <div className="flex flex-col gap-6 border-t border-stone-200 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <MonoLabel>Make sample</MonoLabel>
        <span className="text-[13px] text-stone-600">
          spent ${spent.toFixed(2)} · next video ≈ ${videoCost(options.method, seconds).toFixed(2)} · audio ≈ ${audioCost(status.speechSeconds ?? 26).toFixed(2)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 text-[14px] sm:grid-cols-2 lg:grid-cols-4">
        <Select label="Method" value={options.method} onChange={(v) => setOption({ method: v as SampleOptions["method"] })} options={Object.entries(METHOD_HELP)} />
        <Select label="Background (B)" value={options.background} onChange={(v) => setOption({ background: v as SampleOptions["background"] })} options={[["office", "Office"], ["studio", "Studio"], ["street", "Street"]]} disabled={options.method !== "scene"} />
        <Select label="Layout" value={options.layout} onChange={(v) => setOption({ layout: v as SampleOptions["layout"] })} options={[["boxed", "Boxed 16:9 in frame"], ["full", "Full 9:16"]]} />
        <Select label="Music" value={options.mood} onChange={(v) => setOption({ mood: v as SampleOptions["mood"] })} options={[["calm", "Calm"], ["energetic", "Energetic"]]} />
        {options.method === "real" && (
          <label className="flex flex-col gap-1">
            <span className="text-stone-600">Clip starts at (s)</span>
            <input type="number" min={0} max={170} className="h-10 border border-stone-950/16 px-3" defaultValue={options.clipStart} onBlur={(e) => setOption({ clipStart: Number(e.target.value) })} />
          </label>
        )}
      </div>

      {status.stages.prep.state === "done" && options.method !== "real" && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-stone-600">Face frame for B / C — pick the one with good light and a closed mouth</span>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setOption({ faceFrame: n })} className={cn("border-2", options.faceFrame === n ? "border-stone-950" : "border-transparent")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={status.assets[`face-${n}.jpg`]} alt={`Frame ${n}`} className="aspect-video w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="m-0 flex list-none flex-col divide-y divide-stone-200 border border-stone-200 p-0 text-[14px]">
        {RUNNABLE.map((stage) => {
          const s = status.stages[stage]
          const reasons = blockers(status, stage)
          return (
            <li key={stage} className="grid grid-cols-[90px_1fr_auto] items-center gap-3 px-4 py-3">
              <span className="font-medium">{STAGE_LABEL[stage]}</span>
              <span className="flex min-w-0 flex-col">
                <span className={cn("truncate", s.state === "failed" && "text-[#c2410c]", s.state === "stale" && "text-amber-700")}>
                  {s.state}
                  {s.job?.step ? ` · ${s.job.step}` : ""}
                  {s.startedAt ? ` · ${elapsed(s)}` : ""}
                  {s.cost ? ` · $${s.cost.toFixed(2)}` : ""}
                </span>
                {s.error && <span className="truncate text-[13px] text-[#c2410c]">{s.error}</span>}
                {s.state !== "running" && reasons.length > 0 && <span className="truncate text-[13px] text-stone-500">{reasons.join(" ")}</span>}
              </span>
              <SecondaryButton type="button" className="h-9 px-3 text-[13px]" disabled={busy !== null || s.state === "running" || reasons.length > 0} onClick={() => run(stage)}>
                {s.state === "done" || s.state === "stale" ? "Re-run" : s.state === "failed" ? "Retry" : "Run"}
              </SecondaryButton>
            </li>
          )
        })}
      </ul>

      {status.stages.render.job?.provider === "local" && status.stages.render.state === "running" && (
        <p className="m-0 text-[13px] text-stone-600">
          No Remotion Lambda configured. On a dev machine: <code>STUDIO_ADMIN_TOKEN=… npm run sample:render -- {id}</code>; this page picks up final.mp4 when it lands.
        </p>
      )}

      <label className="flex flex-col gap-1 text-[14px]">
        <span className="text-stone-600">Notes for the script writer (used on the next Script run)</span>
        <input className="h-10 border border-stone-950/16 px-3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. use the latest draw, keep it under 70 words" />
      </label>

      {error && <ErrorText>{error}</ErrorText>}

      {script && <ScriptEditor key={script.createdAt + (script.editedAt ?? "")} file={script} busy={busy !== null} onSave={onSaveScript} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {status.assets["speech.mp3"] && (
          <div className="flex flex-col gap-1 text-[13px] text-stone-600">
            Speech {status.speechSeconds ? `(${status.speechSeconds}s)` : ""}
            <audio controls src={status.assets["speech.mp3"]} className="w-full" />
          </div>
        )}
        {status.assets["talking.mp4"] && (
          <div className="flex flex-col gap-1 text-[13px] text-stone-600">
            Talking video
            <video controls playsInline preload="metadata" src={status.assets["talking.mp4"]} className="max-h-[480px] w-full bg-stone-950 object-contain" />
          </div>
        )}
        {status.assets["final.mp4"] && (
          <div className="flex flex-col gap-1 text-[13px] text-stone-600">
            Final
            <video controls playsInline preload="metadata" src={status.assets["final.mp4"]} className="max-h-[480px] w-full bg-stone-950 object-contain" />
            <a href={status.assets["final.mp4"]} target="_blank" rel="noreferrer" className="underline">
              Open final.mp4
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function Select({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-stone-600">{label}</span>
      <select className="h-10 border border-stone-950/16 bg-white px-2" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}
```

- [ ] **Step 5: Mount it in `admin.tsx`**

In `SubmissionDetail`, after the existing two-column grid's closing `</div>` (still inside the outer wrapper), render `<SamplePanel submission={s} />`. The outer wrapper is currently the grid itself; wrap grid + panel in a `<div className="flex flex-col gap-6 pb-6">` and drop `pb-6` from the grid. Import `SamplePanel`.

- [ ] **Step 6: Typecheck, lint, click through**

`npx tsc --noEmit && npm run lint`. On `localhost:3000/admin`: open a submission → the panel loads with all stages idle; Run Prep → frames appear; Run Script → editor appears; edit a card, Approve; Run Voice → audio player; pick method, Run Video → row shows `running · lipsync`, flips to done within minutes and the talking video plays; Run Audio; Run Render → final plays. Check a blocked stage's button is disabled with the reason under it, and a failed stage shows its error and a Retry button.

- [ ] **Step 7: Commit**

```bash
git add lib/studio/sample/client.ts components/studio/sample-panel.tsx components/studio/script-editor.tsx components/studio/admin.tsx app/api/admin/sample/script/route.ts
git commit -m "Make the sample from /admin: options, stage buttons, script editor, previews"
```

---

### Task 13: Configuration, docs, production build

**Files:**
- Modify: `.env.local` (not committed), `docs/studio-capture/README.md`, `next.config.ts` (already traced in Task 5), `.gitignore`

- [ ] **Step 1: Environment**

`.env.local` must hold: `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `FAL_KEY`, `HIGGSFIELD_KEY_ID`, `HIGGSFIELD_KEY_SECRET`, and when Lambda is set up `REMOTION_AWS_ACCESS_KEY_ID`, `REMOTION_AWS_SECRET_ACCESS_KEY`, `REMOTION_FUNCTION_NAME`, `REMOTION_SERVE_URL`, `REMOTION_REGION`. Add the same to the Vercel project (Production + Preview) before merging.

- [ ] **Step 2: README section**

Append to `docs/studio-capture/README.md` under **Admin**:

```markdown
- **Sample pipeline**: from a submission's row in `/admin`, "Make sample" runs
  Prep (ffmpeg: voice sample + face frames) → Script (GPT-6 Sol searching
  canada.ca; the admin edits and approves) → Voice (ElevenLabs clone + TTS
  with word timings) → Video (A: own footage + fal lipsync, B: Higgsfield
  Seedance + lipsync, C: fal OmniHuman) → Audio (ElevenLabs music + SFX) →
  Render (Remotion Lambda, or `npm run sample:render` locally). Everything is
  written to `{submissionId}/sample/`, with `status.json` as the ledger (stage
  states, job ids, costs). Design and prompts:
  `docs/superpowers/specs/2026-10-09-studio-sample-pipeline-design.md`.
  Keys: `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `FAL_KEY`,
  `HIGGSFIELD_KEY_ID/SECRET`, `REMOTION_*`.
```

- [ ] **Step 3: Production build**

```bash
npm run build
```
Expected: builds; the `/api/admin/sample/run/[stage]` function traces `ffmpeg-static`. If the build complains that `remotion/` TSX pulls in `fixtures/props.json` or Remotion client code into Next, add `"exclude": ["remotion", "scripts"]` to `tsconfig.json` only if the error is a type error from those folders — the server imports only `remotion/types.ts`.

- [ ] **Step 4: Run the whole suite one last time and commit**

```bash
npm test && npx tsc --noEmit && npm run lint
git add docs/studio-capture/README.md tsconfig.json .gitignore
git commit -m "Document the sample pipeline and its keys"
```

---

## Phase 2 (separate plan): Send + review page

`POST /api/admin/sample/run/send` (SendGrid email to `request.email` with `studio.visaflo.ca/watch/{token}`), `app/watch/[token]/page.tsx` showing `final.mp4` with "I'd use this / I'd pay for weekly videos / Not for me", `POST /api/watch/feedback` writing `feedback.json` and a Mixpanel `sample_feedback` event. Planned after the first A/B comparison so the email copy can quote what we learned.

## Self-review notes

- Spec coverage: prep ✔ (T5), script + prompts ✔ (T6), voice/IVC/timestamps ✔ (T7), video A/B/C + chaining ✔ (T8), music/SFX ✔ (T9), Remotion rules (groups, cards top band, one-line values, ducking, headline) ✔ (T10), render Lambda + local ✔ (T11), admin UI ✔ (T12), storage rules ✔ (T4), error handling (failed/stale/timeout/rules message) ✔ (T2, T3, T8), config/docs ✔ (T13). Send/review page deferred to phase 2 as the spec allowed.
- Review Focus → tests: 1 (short recording) T5 `voiceWindow(8)`; 2 (word count mismatch) T7 words tests; 3 (stale after re-run) T2 `startStage` tests; 4 (timeout) T8 poll test; 5 (rules not published) T3 `storageFailure` test.
- Type consistency: `StageJob.provider` includes `"local"` from T2 so T11 needs no type change; `timedOut(state, now, stage)` order used identically in T2 tests and T8 poll; `copyToSample` and `clipSeconds` are exported from `stages.ts` (T8) and imported by `poll.ts`; `renderProps` consumes `Script` (T6) and `Word` (T7); `SampleProps` lives in `remotion/types.ts` and is imported server-side as a type only.

