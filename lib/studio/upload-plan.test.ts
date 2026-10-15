import { describe, expect, it } from "vitest"

import { cancelPlan, filesToStart, planFor, settlePlan, startFile, type UploadPlan } from "@/lib/studio/upload-plan"

const take: { blob: Blob; checks?: { playable: boolean } } = { blob: new Blob(["take"]) }
const photo = { blob: new Blob(["photo"]) }
let ids = 0
const newId = () => `id-${++ids}`

// A controllable upload: settle it by hand.
function upload() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const done = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  const handle = { done, cancelled: false, cancel: () => (handle.cancelled = true) }
  return { handle, resolve, reject }
}

const refusedError = { code: "storage/unauthorized" }

describe("planFor", () => {
  it("keeps the submission for the same take and photo, so submitting again doesn't upload into a new folder", () => {
    const first = planFor(null, take, photo, { refused: false, newId })
    expect(planFor(first, take, photo, { refused: false, newId })).toBe(first)
    // Playing the take back rewrites its checks (a new object, the same bytes): still the same take.
    expect(planFor(first, { ...take, checks: { playable: true } }, photo, { refused: false, newId })).toBe(first)
  })

  it("starts a new submission for a new take, a new photo, or a retry after a refusal", () => {
    const first = planFor(null, take, photo, { refused: false, newId })
    for (const next of [
      planFor(first, { blob: new Blob(["take 2"]) }, photo, { refused: false, newId }),
      planFor(first, take, { blob: new Blob(["photo 2"]) }, { refused: false, newId }),
      planFor(first, take, photo, { refused: true, newId }),
    ]) {
      expect(next).not.toBe(first)
      expect(next.submissionId).not.toBe(first.submissionId)
      expect(next.files).toEqual({})
    }
  })
})

describe("filesToStart and settlePlan", () => {
  it("sends both files the first time", () => {
    expect(filesToStart(planFor(null, take, photo, { refused: false, newId }))).toEqual(["photo", "recording"])
  })

  it("on retry sends only the file that failed, leaving the one that made it", async () => {
    const plan = planFor(null, take, photo, { refused: false, newId })
    const p = upload()
    const r = upload()
    startFile(plan, "photo", () => p.handle)
    startFile(plan, "recording", () => r.handle)
    p.reject({ code: "storage/retry-limit-exceeded" })
    r.resolve()
    const { complete, failures } = await settlePlan(plan)
    expect(complete).toBe(false)
    expect(failures.map((f) => f.name)).toEqual(["photo"])
    expect(filesToStart(plan)).toEqual(["photo"])
  })

  it("waits for a recording still running before reporting a photo that failed fast, and doesn't restart it", async () => {
    const plan = planFor(null, take, photo, { refused: false, newId })
    const p = upload()
    const r = upload()
    startFile(plan, "photo", () => p.handle)
    startFile(plan, "recording", () => r.handle)
    p.reject(refusedError)
    let settled = false
    const result = settlePlan(plan).then((value) => {
      settled = true
      return value
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(settled).toBe(false)
    expect(filesToStart(plan)).toEqual(["photo"])
    r.resolve()
    expect((await result).failures.map((f) => f.name)).toEqual(["photo"])
  })

  it("is complete once both are up, and leaves a cancelled upload out of the failures", async () => {
    const plan = planFor(null, take, photo, { refused: false, newId })
    const p = upload()
    const r = upload()
    startFile(plan, "photo", () => p.handle)
    startFile(plan, "recording", () => r.handle)
    p.resolve()
    r.resolve()
    expect(await settlePlan(plan)).toEqual({ complete: true, failures: [] })

    const other = planFor(null, take, photo, { refused: false, newId })
    const r2 = upload()
    startFile(other, "recording", () => r2.handle)
    r2.reject({ code: "storage/canceled" })
    expect((await settlePlan(other)).failures).toEqual([])
  })
})

describe("settlePlan with a file restarted meanwhile", () => {
  it("waits for the restarted file instead of reporting the failure it replaced", async () => {
    const plan = planFor(null, take, photo, { refused: false, newId })
    const p1 = upload()
    const r = upload()
    startFile(plan, "photo", () => p1.handle)
    startFile(plan, "recording", () => r.handle)
    const first = settlePlan(plan)
    p1.reject({ code: "storage/retry-limit-exceeded" })
    await plan.files.photo?.settled
    // Submit again: only the photo restarts.
    expect(filesToStart(plan)).toEqual(["photo"])
    const p2 = upload()
    startFile(plan, "photo", () => p2.handle)
    r.resolve()
    p2.resolve()
    expect(await first).toEqual({ complete: true, failures: [] })
  })
})

describe("cancelPlan", () => {
  it("cancels only the uploads still running", async () => {
    const plan: UploadPlan<typeof take, typeof photo> = planFor(null, take, photo, { refused: false, newId })
    const p = upload()
    const r = upload()
    startFile(plan, "photo", () => p.handle)
    startFile(plan, "recording", () => r.handle)
    p.resolve()
    await plan.files.photo?.settled
    cancelPlan(plan)
    expect(p.handle.cancelled).toBe(false)
    expect(r.handle.cancelled).toBe(true)
    cancelPlan(null)
  })
})
