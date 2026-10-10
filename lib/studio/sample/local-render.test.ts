import { describe, expect, it, vi } from "vitest"

import { localPid, localRenderAvailable, MANUAL_RENDER_JOB, spawnLocalRender } from "@/lib/studio/sample/local-render"

describe("local render", () => {
  it("is available on a dev machine without Lambda, not on Vercel", () => {
    expect(localRenderAvailable({})).toBe(true)
    expect(localRenderAvailable({ VERCEL: "1" })).toBe(false)
    expect(localRenderAvailable({ REMOTION_FUNCTION_NAME: "f", REMOTION_SERVE_URL: "s", REMOTION_REGION: "us-east-1" })).toBe(false)
  })

  it("starts the render script detached with the admin token in its environment and records the pid", () => {
    const child = { pid: 4242, unref: vi.fn() }
    const spawn = vi.fn().mockReturnValue(child)
    const job = spawnLocalRender("u/s", "tok", spawn as never)
    expect(spawn).toHaveBeenCalledTimes(1)
    const [command, args, options] = spawn.mock.calls[0] as [string, string[], { env: Record<string, string>; detached: boolean }]
    expect(command).toMatch(/node_modules\/\.bin\/tsx$/)
    expect(args).toEqual(["scripts/render-sample.ts", "u/s"])
    expect(options.env.STUDIO_ADMIN_TOKEN).toBe("tok")
    expect(options.detached).toBe(true)
    expect(child.unref).toHaveBeenCalled()
    expect(job).toEqual({ provider: "local", id: "pid:4242" })
  })

  it("tells a started render from props left for a manual run", () => {
    expect(localPid({ provider: "local", id: "pid:4242" })).toBe(4242)
    expect(localPid(MANUAL_RENDER_JOB)).toBeNull()
  })
})
