import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { requireAdmin } from "@/lib/studio/admin-auth"
import { fakeBucket, type Bucket } from "@/lib/studio/test-bucket"

import { GET } from "./route"

vi.mock("@/lib/studio/admin-auth", () => ({ requireAdmin: vi.fn() }))

const admin = vi.mocked(requireAdmin)
const get = (id: string) => GET(new Request(`http://x/api/admin/recording?id=${id}`, { headers: { authorization: "Bearer t" } }))
// The bucket the admin gate hands the route.
const serve = (objects: Bucket) => {
  const bucket = fakeBucket(objects)
  admin.mockResolvedValue({ user: { uid: "a", emailVerified: true }, bucket })
  return bucket
}

describe("GET /api/admin/recording", () => {
  beforeEach(() => {
    serve({ listings: {} })
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("refuses an id that isn't a submission id", async () => {
    expect((await get("../x/y")).status).toBe(400)
    expect((await get("a%2Fb%2Fc")).status).toBe(400)
  })

  it("is 404 without a recording", async () => {
    serve({ listings: { "studio/20261009T211755-393dbaa7/": { items: ["studio/20261009T211755-393dbaa7/request.json"] } } })
    expect((await get("20261009T211755-393dbaa7")).status).toBe(404)
  })

  it("streams the file as a private attachment named after the person, passing the type and length through", async () => {
    const bucket = serve({
      listings: { "studio/20261009T211755-393dbaa7/": { items: ["studio/20261009T211755-393dbaa7/recording.webm", "studio/20261009T211755-393dbaa7/request.json"] } },
      media: { "studio/20261009T211755-393dbaa7/request.json": { name: 'Dan"; x=y' } },
    })
    bucket.read.mockResolvedValue({ body: new Response("hello").body!, contentType: "video/webm", length: 5 })
    const response = await get("20261009T211755-393dbaa7")
    expect(response.status).toBe(200)
    expect(bucket.read).toHaveBeenCalledWith("studio/20261009T211755-393dbaa7/recording.webm")
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="dan-x-y-20261009T211755-393dbaa7.webm"')
    expect(response.headers.get("content-type")).toBe("video/webm")
    expect(response.headers.get("content-length")).toBe("5")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(await response.text()).toBe("hello")
  })

  it("downloads a recorded-only folder quietly, named 'recording', with no made-up length", async () => {
    serve({
      listings: { "studio/20261009T211755-393dbaa7/": { items: ["studio/20261009T211755-393dbaa7/recording.mp4"] } },
      media: { "studio/20261009T211755-393dbaa7/recording.mp4": "bytes" },
    })
    const response = await get("20261009T211755-393dbaa7")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="recording-20261009T211755-393dbaa7.mp4"')
    expect(response.headers.get("content-type")).toBe("text/plain")
    expect(response.headers.get("content-length")).toBeNull()
    expect(await response.text()).toBe("bytes")
    expect(console.error).not.toHaveBeenCalled()
  })

  it("falls back to video/mp4 when the object has no type", async () => {
    const bucket = serve({ listings: { "studio/20261009T211755-393dbaa7/": { items: ["studio/20261009T211755-393dbaa7/recording.mp4"] } } })
    bucket.read.mockResolvedValue({ body: new Response("x").body! })
    expect((await get("20261009T211755-393dbaa7")).headers.get("content-type")).toBe("video/mp4")
  })

  it("still downloads, named 'recording', when request.json can't be read, and logs why", async () => {
    serve({
      listings: { "studio/20261009T211755-393dbaa7/": { items: ["studio/20261009T211755-393dbaa7/recording.mp4", "studio/20261009T211755-393dbaa7/request.json"] } },
      media: { "studio/20261009T211755-393dbaa7/request.json": 500, "studio/20261009T211755-393dbaa7/recording.mp4": "bytes" },
    })
    const response = await get("20261009T211755-393dbaa7")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="recording-20261009T211755-393dbaa7.mp4"')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("request.json for 20261009T211755-393dbaa7"), expect.anything())
  })

  it("logs a stream that breaks mid-body with the submission it was for", async () => {
    const bucket = serve({ listings: { "studio/20261009T211755-393dbaa7/": { items: ["studio/20261009T211755-393dbaa7/recording.mp4"] } } })
    bucket.read.mockResolvedValue({
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("part"))
          controller.error(new Error("upstream reset"))
        },
      }),
      contentType: "video/mp4",
    })
    const response = await get("20261009T211755-393dbaa7")
    expect(response.status).toBe(200)
    await expect(response.text()).rejects.toThrow()
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Streaming the recording for 20261009T211755-393dbaa7"), expect.anything())
  })

  it("downloads the photo with &file=photo, named like the recording", async () => {
    const bucket = serve({
      listings: { "studio/20261009T211755-393dbaa7/": { items: ["studio/20261009T211755-393dbaa7/photo.jpg", "studio/20261009T211755-393dbaa7/recording.mp4", "studio/20261009T211755-393dbaa7/request.json"] } },
      media: { "studio/20261009T211755-393dbaa7/request.json": { name: "Dan Jeong" } },
    })
    bucket.read.mockResolvedValue({ body: new Response("jpeg").body!, contentType: undefined, length: 4 })
    const response = await GET(new Request("http://x/api/admin/recording?id=20261009T211755-393dbaa7&file=photo"))
    expect(response.status).toBe(200)
    expect(bucket.read).toHaveBeenCalledWith("studio/20261009T211755-393dbaa7/photo.jpg")
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="dan-jeong-20261009T211755-393dbaa7.jpg"')
    expect(response.headers.get("content-type")).toBe("image/jpeg")
  })

  it("is 404 for a photo the folder doesn't have, and 400 for an unknown file", async () => {
    serve({ listings: { "studio/20261009T211755-393dbaa7/": { items: ["studio/20261009T211755-393dbaa7/recording.mp4"] } } })
    const photo = await GET(new Request("http://x/api/admin/recording?id=20261009T211755-393dbaa7&file=photo"))
    expect(photo.status).toBe(404)
    expect(await photo.json()).toEqual({ error: "No photo in that folder." })
    expect((await GET(new Request("http://x/api/admin/recording?id=20261009T211755-393dbaa7&file=request.json"))).status).toBe(400)
  })

  it("tells a refused service account from the rest", async () => {
    serve({ listings: { "studio/20261009T211755-393dbaa7/": 403 } })
    const refused = await get("20261009T211755-393dbaa7")
    expect(refused.status).toBe(502)
    expect(((await refused.json()) as { error: string }).error).toContain("service account")

    serve({ listings: { "studio/20261009T211755-393dbaa7/": 401 } })
    expect((await get("20261009T211755-393dbaa7")).status).toBe(502)

    serve({ listings: { "studio/20261009T211755-393dbaa7/": 500 } })
    expect((await get("20261009T211755-393dbaa7")).status).toBe(500)
  })

  it("passes the admin gate's own response through", async () => {
    admin.mockResolvedValue(Response.json({ error: "no" }, { status: 403 }))
    expect((await get("20261009T211755-393dbaa7")).status).toBe(403)
  })
})
