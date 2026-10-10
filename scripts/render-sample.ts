// Local fallback for the Render stage, until Remotion Lambda is set up:
//   STUDIO_ADMIN_TOKEN=… npm run sample:render -- <uid/submissionId>
// Reads render-props.json from the bucket, renders with the local Chrome,
// uploads final.mp4 next to it; the admin page's poller picks it up.
import { readFile } from "node:fs/promises"
import path from "node:path"
import { bundle } from "@remotion/bundler"
import { renderMedia, selectComposition } from "@remotion/renderer"

import { parseSampleId, sampleFile } from "../lib/studio/sample/context"
import { storageJson, storageUpload } from "../lib/studio/storage"

async function main() {
  const id = process.argv[2]
  const token = process.env.STUDIO_ADMIN_TOKEN
  const ref = parseSampleId(id)
  if (!ref || !token) throw new Error("usage: STUDIO_ADMIN_TOKEN=… npm run sample:render -- <uid/submissionId>")

  const inputProps = await storageJson<Record<string, unknown>>(token, sampleFile(ref, "render-props.json"))
  const serveUrl = await bundle({ entryPoint: path.resolve("remotion/index.ts"), publicDir: path.resolve("remotion/fixtures") })
  const composition = await selectComposition({ serveUrl, id: "Sample", inputProps })
  const out = path.resolve(`out/${ref.uid}-${ref.submissionId}.mp4`)
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: out,
    inputProps,
    browserExecutable: process.env.REMOTION_BROWSER ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    onProgress: (p) => process.stdout.write(`\r${Math.round(p.progress * 100)}%`),
  })
  await storageUpload(token, sampleFile(ref, "final.mp4"), new Uint8Array(await readFile(out)), "video/mp4")
  console.log(`\nuploaded ${sampleFile(ref, "final.mp4")}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
