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

  it("streams the file as a private attachment named after the person, passing the type and length through", async () => {
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
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(await response.text()).toBe("hello")
  })

  it("downloads a recorded-only folder quietly, named by uid, with a default type and no made-up length", async () => {
    fakeBucket({
      listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4"] } },
      media: { "studio/u1/s1/recording.mp4": "bytes" },
    })
    const response = await get("u1/s1")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="u1-s1.mp4"')
    expect(response.headers.get("content-type")).toBe("text/plain")
    expect(await response.text()).toBe("bytes")
    expect(console.error).not.toHaveBeenCalled()
  })

  it("still downloads, named by uid, when request.json can't be read, and logs why", async () => {
    fakeBucket({
      listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4", "studio/u1/s1/request.json"] } },
      media: { "studio/u1/s1/request.json": 500, "studio/u1/s1/recording.mp4": "bytes" },
    })
    const response = await get("u1/s1")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="u1-s1.mp4"')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("request.json for u1/s1"), expect.anything())
  })

  it("logs a stream that breaks mid-body with the submission it was for", async () => {
    const broken = () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("part"))
          controller.error(new Error("upstream reset"))
        },
      })
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input))
        if (url.pathname.endsWith("/o")) return Response.json({ items: [{ name: "studio/u1/s1/recording.mp4" }] })
        if (url.pathname.includes("request.json")) return new Response("not found", { status: 404 })
        return new Response(broken(), { headers: { "content-type": "video/mp4" } })
      }),
    )
    const response = await get("u1/s1")
    expect(response.status).toBe(200)
    await expect(response.text()).rejects.toThrow()
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Streaming the recording for u1/s1"), expect.anything())
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

  it("passes the admin gate's own response through without touching Storage", async () => {
    admin.mockResolvedValue(Response.json({ error: "no" }, { status: 403 }))
    const fetch = fakeBucket({ listings: { "studio/u1/s1/": { items: ["studio/u1/s1/recording.mp4"] } } })
    expect((await get("u1/s1")).status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
  })
})
