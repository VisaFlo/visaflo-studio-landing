import { fetchOrBlip, type JobPoll } from "@/lib/studio/sample/fal"
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
  const response = await fetchOrBlip(job.statusUrl, { headers: headers(), cache: "no-store" })
  if (response === "blip") return { state: "running" }
  if (!response.ok) return { state: "failed", error: `Higgsfield status ${response.status}: ${(await response.text()).slice(0, 200)}` }
  const body = (await response.json()) as { status: string; error?: string; video?: { url?: string } }
  const status = body.status.toLowerCase()
  if (status === "queued" || status === "in_progress" || status === "processing" || status === "in_queue") return { state: "running" }
  if (status !== "completed") return { state: "failed", error: `Higgsfield ${status}: ${body.error ?? ""}`.trim() }
  return body.video?.url ? { state: "done", videoUrl: body.video.url } : { state: "failed", error: "Higgsfield returned no video" }
}
