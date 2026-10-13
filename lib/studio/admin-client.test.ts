import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { User } from "firebase/auth"

import { adminRequest } from "@/lib/studio/admin-client"

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const user = (token = "tok") => ({ getIdToken: vi.fn(async () => token) }) as unknown as User
const pick = (body: Record<string, unknown>) => (Array.isArray(body.items) ? (body.items as string[]) : undefined)
const reply = (body: BodyInit | null, status = 200, type = "application/json") => {
  const fetch = vi.fn<Fetch>(async () => new Response(body, { status, headers: { "content-type": type } }))
  vi.stubGlobal("fetch", fetch)
  return fetch
}

describe("adminRequest", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("asks for a fresh token and sends it as Bearer", async () => {
    const fetch = reply(JSON.stringify({ items: ["a"] }))
    const u = user("fresh")
    expect(await adminRequest(u, "/api/admin/submissions", pick)).toEqual({ status: "ready", data: ["a"] })
    expect(u.getIdToken).toHaveBeenCalledWith(true)
    expect(fetch.mock.calls[0][1]).toMatchObject({ headers: { Authorization: "Bearer fresh" } })
  })

  it("shows the verify panel on code=unverified whatever the status", async () => {
    reply(JSON.stringify({ error: "Verify your email first.", code: "unverified" }), 403)
    expect(await adminRequest(user(), "/api/admin/submissions", pick)).toEqual({ status: "unverified" })
  })

  it("surfaces the server's own error, else the status, and logs a body that isn't JSON", async () => {
    reply(JSON.stringify({ error: "Storage refused the read." }), 502)
    expect(await adminRequest(user(), "/api/admin/submissions", pick)).toEqual({ status: "error", message: "Storage refused the read." })

    reply("<html>Gateway timeout</html>", 504, "text/html")
    expect(await adminRequest(user(), "/api/admin/submissions", pick)).toEqual({
      status: "error",
      message: "Request failed (504). Reload to try again.",
    })
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("/api/admin/submissions"), 504, expect.stringContaining("Gateway timeout"))
  })

  it("treats a 200 with the wrong shape as an error", async () => {
    reply(JSON.stringify({ nope: 1 }))
    expect(await adminRequest(user(), "/api/admin/submissions", pick)).toMatchObject({ status: "error" })
  })

  it("maps a dropped connection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch")
      }),
    )
    expect(await adminRequest(user(), "/api/admin/submissions", pick)).toEqual({
      status: "error",
      message: "No connection. Check your internet, then reload.",
    })
  })
})
