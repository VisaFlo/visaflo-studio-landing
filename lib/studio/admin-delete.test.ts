import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { deleteSubmission } from "@/lib/studio/admin-delete"

const user = { getIdToken: vi.fn(async () => "tok") }
type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
const reply = (response: () => Response | Promise<Response>) => {
  const fetch = vi.fn<Fetch>(async () => response())
  vi.stubGlobal("fetch", fetch)
  return fetch
}

describe("deleteSubmission", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("sends a DELETE for that submission with the admin's token", async () => {
    const fetch = reply(() => Response.json({ deleted: 2 }))
    await deleteSubmission(user, "u1/s1")
    expect(String(fetch.mock.calls[0][0])).toBe("/api/admin/submissions?id=u1%2Fs1")
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "DELETE", headers: { Authorization: "Bearer tok" } })
  })

  it("throws the route's own message as an ApiError", async () => {
    reply(() => Response.json({ error: "We deleted 1 of 2 files. Still there: recording.webm. Try again." }, { status: 500 }))
    await expect(deleteSubmission(user, "u1/s1")).rejects.toMatchObject({
      name: "ApiError",
      message: "We deleted 1 of 2 files. Still there: recording.webm. Try again.",
    })
  })

  it("lets a fetch that never reached the server reject as it did", async () => {
    reply(() => Promise.reject(new TypeError("Failed to fetch")))
    await expect(deleteSubmission(user, "u1/s1")).rejects.toBeInstanceOf(TypeError)
  })
})
