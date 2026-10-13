import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { fetchRecording } from "@/lib/studio/admin-download"
import { ApiError } from "@/lib/studio/errors"

const user = { getIdToken: vi.fn(async () => "tok") }
type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
const reply = (response: () => Response) => {
  const fetch = vi.fn<Fetch>(async () => response())
  vi.stubGlobal("fetch", fetch)
  return fetch
}

describe("fetchRecording", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("sends the admin's token and takes the file name the route chose", async () => {
    const fetch = reply(() => new Response("bytes", { headers: { "content-disposition": 'attachment; filename="dan-s1.mp4"' } }))
    const { blob, filename } = await fetchRecording(user, "u1/s1")
    expect(filename).toBe("dan-s1.mp4")
    expect(await blob.text()).toBe("bytes")
    expect(String(fetch.mock.calls[0][0])).toContain("/api/admin/recording?id=u1%2Fs1")
    expect(fetch.mock.calls[0][1]).toMatchObject({ headers: { Authorization: "Bearer tok" } })
  })

  it("falls back to a plain name when the header is missing", async () => {
    reply(() => new Response("bytes"))
    expect((await fetchRecording(user, "u1/s1")).filename).toBe("recording.mp4")
  })

  it("shows the route's own message for a refusal", async () => {
    reply(() => Response.json({ error: "Storage refused the read." }, { status: 502 }))
    await expect(fetchRecording(user, "u1/s1")).rejects.toMatchObject({ name: "ApiError", message: "Storage refused the read." })
  })

  it("reports a body that breaks after the headers as cut off, not as a connection problem", async () => {
    reply(
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("part"))
              controller.error(new TypeError("terminated"))
            },
          }),
        ),
    )
    const failure = fetchRecording(user, "u1/s1")
    await expect(failure).rejects.toBeInstanceOf(ApiError)
    await expect(failure).rejects.toThrow("cut off")
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("u1/s1"), expect.anything())
  })
})
