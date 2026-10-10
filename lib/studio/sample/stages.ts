import { readFile } from "node:fs/promises"
import path from "node:path"

import { OWN_TOPIC_ID, TOPICS } from "@/lib/studio/content"
import { sampleFile, type SampleRef } from "@/lib/studio/sample/context"
import { PRICES, ttsCost } from "@/lib/studio/sample/costs"
import { createVoice, synthesize } from "@/lib/studio/sample/elevenlabs"
import { LIPSYNC_MODELS, OMNIHUMAN_MODEL, submitFal } from "@/lib/studio/sample/fal"
import { cutClip, downloadTo, extractFrame, extractVoiceSample, frameTimes, probeSeconds, tmpDir } from "@/lib/studio/sample/ffmpeg"
import { submitSeedance } from "@/lib/studio/sample/higgsfield"
import { OMNIHUMAN_PROMPT, scenePrompt } from "@/lib/studio/sample/prompts"
import { generateScript, SCRIPT_MODEL, type ScriptFile } from "@/lib/studio/sample/script"
import { templateFor, templateId } from "@/lib/studio/sample/scripts"
import type { SampleStatus, Stage, StageJob, StagePatch } from "@/lib/studio/sample/status"
import { wordsFromAlignment } from "@/lib/studio/sample/words"
import { listObjects, mediaUrl, storageBytes, storageGet, storageJson, storageMeta, storageUpload, StorageError } from "@/lib/studio/storage"

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

type RequestJson = { topicId?: string; topicTitle?: string }

// Everyone who picks a topic gets that topic's fixed, pre-checked script, so
// the stage is instant and free and the admin only has to glance at it.
// `source: "gpt"` instead asks GPT for a fresh one on this week's news; that
// draft starts unapproved.
const script: StageWork = async ({ token, ref, body }) => {
  const request = await storageJson<RequestJson>(token, `${ref.folder}/request.json`).catch(() => ({}) as RequestJson)
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 500) : undefined
  const createdAt = new Date().toISOString()

  let file: ScriptFile
  let cost = 0
  if (body.source === "gpt") {
    const topic = TOPICS.find((t) => t.id === request.topicId)
    const { script, searchSources } = await generateScript({
      topic: topic?.detail ?? request.topicTitle ?? "Canadian immigration",
      ownTopic: request.topicId === OWN_TOPIC_ID ? request.topicTitle : undefined,
      today: createdAt.slice(0, 10),
      notes,
    })
    file = { draft: script, approved: false, model: SCRIPT_MODEL, createdAt, notes, searchSources }
    cost = PRICES.scriptCall
  } else {
    file = { draft: templateFor(request.topicId), approved: true, model: `template:${templateId(request.topicId)}`, createdAt, searchSources: [] }
  }
  await storageUpload(token, sampleFile(ref, "script.json"), JSON.stringify(file, null, 2), "application/json")
  return { done: true, cost, patch: { scriptApproved: file.approved } }
}

export const MAX_SPEECH_SECONDS = 30

// Clone once per person (the voice id is kept in status.json), then speak the
// approved script with character timings that become the caption words.
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

// Providers keep outputs for a limited time; copy them into our folder.
export async function copyToSample(token: string, ref: SampleRef, url: string, name: string, contentType: string): Promise<string> {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) throw new Error(`Could not download ${name} from the provider (${response.status})`)
  return uploadAsset(token, ref, name, new Uint8Array(await response.arrayBuffer()), contentType)
}

export function clipSeconds(speechSeconds: number): number {
  return Math.min(30, Math.ceil(speechSeconds) + 1)
}

// A: their own footage, lips re-synced. B: Seedance scene from a face frame,
// then lips re-synced (the poller chains it). C: OmniHuman from the frame in
// one step. All three leave the provider job in status.json for the poller.
const video: StageWork = async ({ token, ref, status }) => {
  const speechUrl = status.assets["speech.mp3"]
  if (!speechUrl || !status.speechSeconds) throw new Error("Run Voice first")
  const seconds = clipSeconds(status.speechSeconds)
  const { method, faceFrame, clipStart, layout, background, lipsync } = status.options

  if (method === "real") {
    const dir = await tmpDir()
    const { file, seconds: recorded } = await downloadRecording(token, ref, dir)
    const start = Math.max(0, Math.min(clipStart, recorded - seconds))
    const clip = path.join(dir, "clip.mp4")
    await cutClip(file, clip, { start, seconds, crop: layout === "full" })
    const clipUrl = await uploadAsset(token, ref, "clip.mp4", await readFile(clip), "video/mp4")
    const job = await submitFal(LIPSYNC_MODELS[lipsync], { video_url: clipUrl, audio_url: speechUrl, sync_mode: "cut_off" })
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
