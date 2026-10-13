import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { requireAdmin } from "@/lib/studio/admin-auth"
import { fakeBucket } from "@/lib/studio/test-bucket"

import { GET } from "./route"

vi.mock("@/lib/studio/admin-auth", () => ({ requireAdmin: vi.fn() }))

const admin = vi.mocked(requireAdmin)
const get = (id: string) => GET(new Request(`http://x/api/admin/recording?id=${id}`, { headers: { authorization: "Bearer t" } }))

describe("GET /api/admin/recording", () => {
  beforeEach(() => {
    admin.mockResolvedValue({ user: { uid: "a", email: "bkim@vflo.app", emailVerified: true }, token: "t" })
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("refuses an id that isn't uid/submissionId", async () => {
    expect((await get("../x/y")).status).toBe(400)
    expect((await get("a%2Fb%2Fc")).status).toBe(400)
  })

  it("is 404 without a recording", async () => {
    fakeBucket({ listings: { "studio/u1/s1/": { items: ["studio/u1/s1/request.json"] } } })
    expect((await get("u1/s1")).status).toBe(404)
  })

  it("streams the file as an attachment named after the person, passing the type and length through", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input))
        if (url.pathname.endsWith("/o")) {
          return Response.json({ items: [{ name: "studio/u1/s1/recording.webm" }, { name: "studio/u1/s1/request.json" }] })
        }
        if (url.pathname.includes("request.json")) return Response.json({ name: 'Dan"; x=y' })
        return new Response("hello", { headers: { "content-type": "video/webm", "content-length": "5" } })
      }),
    )
    const response = await get("u1/s1")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="dan-x-y-s1.webm"')
    expect(response.headers.get("content-type")).toBe("video/webm")
    expect(response.headers.get("content-length")).toBe("5")
    expect(await response.text()).toBe("hello")
  })

  it("still downloads, named by uid, when request.json can't be read", async () => {
    fakeBucket({
      listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4", "studio/u1/s1/request.json"] } },
      media: { "studio/u1/s1/request.json": 500, "studio/u1/s1/recording.mp4": "bytes" },
    })
    const response = await get("u1/s1")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="u1-s1.mp4"')
  })

  it("tells rules problems from sign-in problems from the rest", async () => {
    fakeBucket({ listings: { "studio/u1/s1/": 403 } })
    const refused = await get("u1/s1")
    expect(refused.status).toBe(502)
    expect(((await refused.json()) as { error: string }).error).toContain("storage.rules")

    fakeBucket({ listings: { "studio/u1/s1/": 401 } })
    expect((await get("u1/s1")).status).toBe(401)

    fakeBucket({ listings: { "studio/u1/s1/": 500 } })
    expect((await get("u1/s1")).status).toBe(500)
  })

  it("passes the admin gate's own response through", async () => {
    admin.mockResolvedValue(Response.json({ error: "no" }, { status: 403 }))
    expect((await get("u1/s1")).status).toBe(403)
  })
})
