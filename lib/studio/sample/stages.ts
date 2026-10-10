import { readFile } from "node:fs/promises"
import path from "node:path"

import { sampleFile, type SampleRef } from "@/lib/studio/sample/context"
import { downloadTo, extractFrame, extractVoiceSample, frameTimes, probeSeconds, tmpDir } from "@/lib/studio/sample/ffmpeg"
import type { SampleStatus, Stage, StageJob, StagePatch } from "@/lib/studio/sample/status"
import { listObjects, mediaUrl, storageGet, storageMeta, storageUpload, StorageError } from "@/lib/studio/storage"

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
