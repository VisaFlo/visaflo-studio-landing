import type { LipsyncModel, StageJob } from "@/lib/studio/sample/status"

export type JobPoll = { state: "running" } | { state: "done"; videoUrl: string } | { state: "failed"; error: string }

// Sync Labs lipsync-2: standard is 60% of pro's price; the first comparison
// decides whether pro is worth it.
export const LIPSYNC_MODELS: Record<LipsyncModel, string> = {
  standard: "fal-ai/sync-lipsync/v2",
  pro: "fal-ai/sync-lipsync/v2/pro",
}
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

// A provider blip (5xx, rate limit, dropped connection) is not an answer about
// the job: keep polling and let the stage timeout be the backstop, so a paid
// job isn't abandoned and re-bought.
export function isBlip(status: number): boolean {
  return status >= 500 || status === 429 || status === 408
}

export async function fetchOrBlip(url: string, init: RequestInit): Promise<Response | "blip"> {
  try {
    const response = await fetch(url, init)
    return isBlip(response.status) ? "blip" : response
  } catch {
    return "blip"
  }
}

export async function pollFal(job: StageJob): Promise<JobPoll> {
  if (!job.statusUrl || !job.responseUrl) return { state: "failed", error: "fal job lost its urls" }
  const status = await fetchOrBlip(job.statusUrl, { headers: headers(), cache: "no-store" })
  if (status === "blip") return { state: "running" }
  if (!status.ok) return { state: "failed", error: `fal status ${status.status}: ${(await status.text()).slice(0, 200)}` }
  const body = (await status.json()) as { status: string; error?: string }
  if (body.status === "IN_QUEUE" || body.status === "IN_PROGRESS") return { state: "running" }
  if (body.status !== "COMPLETED") return { state: "failed", error: `fal ${body.status}: ${body.error ?? ""}`.trim() }
  const result = await fetchOrBlip(job.responseUrl, { headers: headers(), cache: "no-store" })
  if (result === "blip") return { state: "running" }
  if (!result.ok) return { state: "failed", error: `fal result ${result.status}: ${(await result.text()).slice(0, 200)}` }
  const out = (await result.json()) as { video?: { url?: string } }
  return out.video?.url ? { state: "done", videoUrl: out.video.url } : { state: "failed", error: "fal returned no video" }
}
