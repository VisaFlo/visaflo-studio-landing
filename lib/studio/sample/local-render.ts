import { spawn as nodeSpawn } from "node:child_process"
import { openSync, readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import { lambdaConfigured } from "@/lib/studio/sample/render"
import type { StageJob } from "@/lib/studio/sample/status"

// Render stage without Remotion Lambda. On a dev machine the server starts
// `npm run sample:render` itself (Chrome on this Mac, final.mp4 uploaded by
// the script); on Vercel it can only leave render-props.json for someone to
// run that command by hand.
export const MANUAL_RENDER_JOB: StageJob = { provider: "local", id: "render-props.json" }

export function localRenderAvailable(env: Record<string, string | undefined> = process.env): boolean {
  return !lambdaConfigured(env) && !env.VERCEL
}

export function localRenderLog(id: string): string {
  return path.join(os.tmpdir(), `visaflo-render-${id.replace(/\//g, "-")}.log`)
}

export function spawnLocalRender(id: string, token: string, spawn: typeof nodeSpawn = nodeSpawn): StageJob {
  const log = openSync(localRenderLog(id), "w")
  const child = spawn(path.resolve("node_modules/.bin/tsx"), ["scripts/render-sample.ts", id], {
    cwd: process.cwd(),
    env: { ...process.env, STUDIO_ADMIN_TOKEN: token },
    detached: true,
    stdio: ["ignore", log, log],
  })
  child.unref()
  return { provider: "local", id: `pid:${child.pid}` }
}

// The pid of a render this server started, or null for props left for a manual run.
export function localPid(job: StageJob): number | null {
  const m = /^pid:(\d+)$/.exec(job.id)
  return m ? Number(m[1]) : null
}

export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function logTail(id: string, chars = 300): string {
  try {
    return readFileSync(localRenderLog(id), "utf8").trim().slice(-chars)
  } catch {
    return ""
  }
}
