import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { requireAdmin } from "@/lib/studio/admin-auth"
import { fakeBucket, type Bucket } from "@/lib/studio/test-bucket"

import { DELETE, GET } from "./route"

vi.mock("@/lib/studio/admin-auth", () => ({ requireAdmin: vi.fn() }))

const admin = vi.mocked(requireAdmin)
const get = (query = "") => GET(new Request(`http://x/api/admin/submissions${query}`, { headers: { authorization: "Bearer t" } }))
const remove = (query = "") => DELETE(new Request(`http://x/api/admin/submissions${query}`, { method: "DELETE", headers: { authorization: "Bearer t" } }))
const errorOf = async (r: Response) => ((await r.json()) as { error: string }).error
const META = { name: "r", size: "1", contentType: "video/mp4", timeCreated: "2026-10-09T00:00:00.000Z", downloadTokens: "tok" }
// The bucket the admin gate hands the route.
const serve = (objects: Bucket) => {
  const bucket = fakeBucket(objects)
  admin.mockResolvedValue({ user: { uid: "a", emailVerified: true }, bucket })
  return bucket
}

describe("GET /api/admin/submissions", () => {
  beforeEach(() => {
    serve({ listings: {} })
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("lists every submission", async () => {
    serve({
      listings: { "studio/": { prefixes: ["studio/u1/"] }, "studio/u1/": { prefixes: ["studio/u1/s1/"] }, "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4"] } },
      meta: { "studio/u1/s1/recording.mp4": META },
    })
    const body = (await (await get()).json()) as { submissions: { id: string }[] }
    expect(body.submissions.map((s) => s.id)).toEqual(["u1/s1"])
  })

  it("returns one submission with its problems rather than hiding it", async () => {
    serve({
      listings: { "studio/u1/s1/": { items: ["studio/u1/s1/request.json"] } },
      media: { "studio/u1/s1/request.json": { name: "Dan", topicTitle: "Family" } },
    })
    const response = await get("?id=u1/s1")
    expect(response.status).toBe(200)
    const body = (await response.json()) as { submission: { name: string; problems: { kind: string }[] } }
    expect(body.submission.name).toBe("Dan")
    expect(body.submission.problems).toEqual([{ kind: "no-recording" }])
  })

  it("is 400 for a bad id and 404 for an empty folder", async () => {
    expect((await get("?id=../x")).status).toBe(400)
    expect((await get("?id=u1/none")).status).toBe(404)
  })

  it("maps a refused read to the service account message", async () => {
    serve({ listings: { "studio/": 403 } })
    const refused = await get()
    expect(refused.status).toBe(502)
    expect(await errorOf(refused)).toContain("service account")
  })

  it("passes the admin gate's own response through", async () => {
    admin.mockResolvedValue(Response.json({ error: "no" }, { status: 403 }))
    expect((await get()).status).toBe(403)
  })
})

describe("DELETE /api/admin/submissions", () => {
  const folder = { "studio/u1/s1/": { items: ["studio/u1/s1/recording.webm", "studio/u1/s1/request.json"] } }

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "info").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("deletes every object in the folder and says how many, logging who did it", async () => {
    const bucket = serve({ listings: folder })
    const response = await remove("?id=u1/s1")
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ deleted: 2 })
    expect(bucket.list).toHaveBeenCalledWith("studio/u1/s1/")
    expect(bucket.remove.mock.calls.map(([name]) => name).sort()).toEqual(["studio/u1/s1/recording.webm", "studio/u1/s1/request.json"])
    expect(console.info).toHaveBeenCalledWith(expect.stringMatching(/a deleted .*u1\/s1/))
  })

  it("refuses an id that isn't uid/submissionId, touching nothing", async () => {
    const bucket = serve({ listings: folder })
    for (const query of ["", "?id=../x", "?id=u1", "?id=u1/s1/x", "?id=u1%2Fs1%2F..%2F.."]) {
      expect((await remove(query)).status).toBe(400)
    }
    expect(bucket.list).not.toHaveBeenCalled()
    expect(bucket.remove).not.toHaveBeenCalled()
  })

  it("is 404 for a folder with nothing in it", async () => {
    const bucket = serve({ listings: {} })
    const response = await remove("?id=u1/gone")
    expect(response.status).toBe(404)
    expect(bucket.remove).not.toHaveBeenCalled()
  })

  it("tries every object and names the ones it couldn't delete", async () => {
    const bucket = serve({ listings: folder, deletes: { "studio/u1/s1/recording.webm": 503 } })
    const response = await remove("?id=u1/s1")
    expect(response.status).toBe(500)
    expect(await errorOf(response)).toBe("We deleted 1 of 2 files. Still there: recording.webm. Try again.")
    expect(bucket.remove).toHaveBeenCalledTimes(2)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("studio/u1/s1/recording.webm"), expect.anything())
  })

  it("counts an object already gone as deleted", async () => {
    serve({ listings: folder, deletes: { "studio/u1/s1/request.json": 404 } })
    const response = await remove("?id=u1/s1")
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ deleted: 2 })
  })

  it("maps a refused service account to its message", async () => {
    serve({ listings: folder, deletes: { "studio/u1/s1/recording.webm": 403, "studio/u1/s1/request.json": 403 } })
    const response = await remove("?id=u1/s1")
    expect(response.status).toBe(502)
    expect(await errorOf(response)).toContain("service account")
  })

  it("passes the admin gate's own response through", async () => {
    admin.mockResolvedValue(Response.json({ error: "no" }, { status: 403 }))
    expect((await remove("?id=u1/s1")).status).toBe(403)
  })
})
