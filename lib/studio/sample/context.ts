import { requireAdmin } from "@/lib/studio/admin-auth"
import { defaultStatus, type SampleOptions, type SampleStatus } from "@/lib/studio/sample/status"
import { StorageError, storageJson, storageUpload } from "@/lib/studio/storage"
import { PALETTES } from "@/remotion/types"

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
const PALETTE_CHOICES = ["auto", ...PALETTES] as const
const LIPSYNC = ["standard", "pro"] as const

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
    palette: pick(v.palette, PALETTE_CHOICES, current.palette ?? "auto"),
    lipsync: pick(v.lipsync, LIPSYNC, current.lipsync),
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
