// One submission's upload: its folder, the take and photo it is for, and each
// file's own upload. The storage rules let each file be created once, so:
// - Submitting the same take and photo again keeps the folder and only
//   starts what isn't up yet (or running); a new take or photo is a new
//   folder.
// - A retry re-sends only the files that failed and leaves one still running
//   alone.
// - A retry after a refusal starts a new folder: a refused file may well be
//   in the bucket already (the reply was lost), and the same path would be
//   refused again forever.

export type UploadFile = "recording" | "photo"

export type FileUpload = {
  status: "running" | "done" | "failed"
  /** Settles with the upload; never rejects (the outcome is in `status` and `error`). */
  settled: Promise<void>
  cancel: () => void
  error?: unknown
}

/** A take or photo: matched by its bytes, so a take whose checks change (it was played) is still the same take. */
type Media = { blob: Blob }

export type UploadPlan<R extends Media, P extends Media> = {
  submissionId: string
  recording: R
  photo: P
  files: Partial<Record<UploadFile, FileUpload>>
}

export function planFor<R extends Media, P extends Media>(
  current: UploadPlan<R, P> | null,
  recording: R,
  photo: P,
  { refused, newId }: { refused: boolean; newId: () => string },
): UploadPlan<R, P> {
  if (current && !refused && isFor(current, recording, photo)) return current
  return { submissionId: newId(), recording, photo, files: {} }
}

/** Whether `plan` uploads this take and this photo. */
export function isFor(plan: UploadPlan<Media, Media>, recording: Media, photo: Media): boolean {
  return plan.recording.blob === recording.blob && plan.photo.blob === photo.blob
}

/** The files to start now: never started, or failed. */
export function filesToStart(plan: UploadPlan<Media, Media>): UploadFile[] {
  return (["photo", "recording"] as const).filter((name) => {
    const file = plan.files[name]
    return !file || file.status === "failed"
  })
}

/** Starts one file's upload and tracks it in the plan. */
export function startFile(
  plan: UploadPlan<Media, Media>,
  name: UploadFile,
  start: () => { done: Promise<void>; cancel: () => void },
): void {
  const { done, cancel } = start()
  const file: FileUpload = { status: "running", settled: Promise.resolve(), cancel }
  file.settled = done.then(
    () => {
      file.status = "done"
    },
    (error: unknown) => {
      file.status = "failed"
      file.error = error
    },
  )
  plan.files[name] = file
}

export function cancelPlan(plan: UploadPlan<Media, Media> | null): void {
  for (const file of Object.values(plan?.files ?? {})) if (file.status === "running") file.cancel()
}

const canceled = (error: unknown) => (error as { code?: string } | null)?.code === "storage/canceled"

/**
 * Waits until no file of the plan is running (one that fails fast doesn't cut
 * short one still running, and a file restarted meanwhile is waited for too),
 * then lists the failures. A cancelled upload is a decision, not a failure,
 * and isn't listed; `complete` is whether every file is up.
 */
export async function settlePlan(plan: UploadPlan<Media, Media>): Promise<{ complete: boolean; failures: { name: UploadFile; error: unknown }[] }> {
  const current = () => (["photo", "recording"] as const).map((name) => [name, plan.files[name]] as const)
  const running = () => current().flatMap(([, file]) => (file?.status === "running" ? [file.settled] : []))
  while (running().length) await Promise.all(running())
  const files = current()
  const failures = files.flatMap(([name, file]) => (file?.status === "failed" && !canceled(file.error) ? [{ name, error: file.error }] : []))
  return { complete: files.every(([, file]) => file?.status === "done"), failures }
}
