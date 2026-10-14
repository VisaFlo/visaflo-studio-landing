// One-off: moves the recordings made while /start needed sign-in, from
// studio/{uid}/{submissionId}/ to studio/{submissionId}/, where /admin and
// the server now look. Everything in the folder moves, sub-folders too (the
// removed automatic pipeline left its output in sample/). Each file is copied (contentType, custom metadata and
// the Firebase download token come along, so the admin player keeps working),
// the copy's md5 and size are checked, and only then is the original deleted.
// Safe to run again: a file already at its new place with the same bytes only
// has its original removed; one with different bytes is reported and left.
//
//   node --env-file=.env.local scripts/migrate-studio-paths.mjs           # dry run: what would move
//   node --env-file=.env.local scripts/migrate-studio-paths.mjs --apply   # move it
//
// Against the local emulator instead: FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
// (no service account needed then).
import { cert, initializeApp } from "firebase-admin/app"
import { getStorage } from "firebase-admin/storage"

const BUCKET = "devdashboard-c9159-ca" // lib/studio/project.ts
const SUBMISSION_ID = /^\d{8}T\d{6}-[0-9a-f]{8}$/ // lib/studio/project.ts
const OLD = /^studio\/([^/]+)\/([^/]+)\/(.+)$/

const apply = process.argv.includes("--apply")
const emulator = Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST)

const app = emulator
  ? initializeApp({ projectId: "demo-studio", storageBucket: BUCKET })
  : initializeApp({
      credential: cert({
        projectId: "devdashboard-c9159",
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
      storageBucket: BUCKET,
    })
const bucket = getStorage(app).bucket(BUCKET)

const [files] = await bucket.getFiles({ prefix: "studio/" })
const moves = []
const skipped = []
for (const file of files) {
  const match = OLD.exec(file.name)
  if (!match) continue // already studio/{submissionId}/{file}
  const [, uid, submissionId, name] = match
  if (!SUBMISSION_ID.test(submissionId)) {
    skipped.push(`${file.name}: "${submissionId}" isn't a submission id`)
    continue
  }
  moves.push({ file, uid, submissionId, target: `studio/${submissionId}/${name}` })
}

console.log(`${emulator ? "emulator" : `gs://${BUCKET}`}: ${files.length} objects under studio/, ${moves.length} to move${apply ? "" : " (dry run; --apply to move)"}`)
for (const line of skipped) console.log(`skip  ${line}`)

let failed = 0
for (const { file, uid, target } of moves) {
  const [source] = await file.getMetadata()
  const label = `${file.name} -> ${target} (${source.size} bytes, uid ${uid})`
  const destination = bucket.file(target)
  const [exists] = await destination.exists()
  if (exists) {
    const [current] = await destination.getMetadata()
    if (current.md5Hash !== source.md5Hash || String(current.size) !== String(source.size)) {
      console.log(`CONFLICT ${label}: a different file is already there; left both alone`)
      failed++
      continue
    }
    console.log(`${apply ? "done" : "would"}  ${label}: already copied, ${apply ? "removed" : "would remove"} the original`)
    if (apply) await file.delete()
    continue
  }
  if (!apply) {
    console.log(`would ${label}`)
    continue
  }
  await file.copy(destination)
  const [copied] = await destination.getMetadata()
  if (copied.md5Hash !== source.md5Hash || String(copied.size) !== String(source.size)) {
    console.log(`MISMATCH ${label}: the copy differs (md5 ${copied.md5Hash} vs ${source.md5Hash}); kept the original`)
    failed++
    continue
  }
  await file.delete()
  console.log(`moved ${label}`)
}

console.log(failed ? `${failed} not moved; see above` : apply ? "all moved" : "dry run done")
process.exit(failed ? 1 : 0)
