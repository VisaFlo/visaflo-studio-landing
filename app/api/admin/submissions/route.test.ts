import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { requireAdmin } from "@/lib/studio/admin-auth"
import { fakeBucket } from "@/lib/studio/test-bucket"

import { GET } from "./route"

vi.mock("@/lib/studio/admin-auth", () => ({ requireAdmin: vi.fn() }))

const admin = vi.mocked(requireAdmin)
const get = (query = "") => GET(new Request(`http://x/api/admin/submissions${query}`, { headers: { authorization: "Bearer t" } }))
const META = { name: "r", size: "1", contentType: "video/mp4", timeCreated: "2026-10-09T00:00:00.000Z", downloadTokens: "tok" }

describe("GET /api/admin/submissions", () => {
  beforeEach(() => {
    admin.mockResolvedValue({ user: { uid: "a", email: "bkim@vflo.app", emailVerified: true }, token: "t" })
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("lists every submission", async () => {
    fakeBucket({
      listings: { "studio/": { prefixes: ["studio/u1/"] }, "studio/u1/": { prefixes: ["studio/u1/s1/"] }, "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4"] } },
      meta: { "studio/u1/s1/recording.mp4": META },
    })
    const body = (await (await get()).json()) as { submissions: { id: string }[] }
    expect(body.submissions.map((s) => s.id)).toEqual(["u1/s1"])
  })

  it("returns one submission with its problems rather than hiding it", async () => {
    fakeBucket({
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
    fakeBucket({ listings: {} })
    expect((await get("?id=u1/none")).status).toBe(404)
  })

  it("maps a refused read to the rules message and a rejected token to 401", async () => {
    fakeBucket({ listings: { "studio/": 403 } })
    const refused = await get()
    expect(refused.status).toBe(502)
    expect(((await refused.json()) as { error: string }).error).toContain("storage.rules")
    fakeBucket({ listings: { "studio/": 401 } })
    expect((await get()).status).toBe(401)
  })

  it("passes the admin gate's own response through without touching Storage", async () => {
    admin.mockResolvedValue(Response.json({ error: "no" }, { status: 403 }))
    const fetch = fakeBucket({ listings: { "studio/": { prefixes: [] } } })
    expect((await get()).status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
  })
})
