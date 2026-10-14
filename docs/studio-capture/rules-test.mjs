// Storage rules matrix for studio/... Run against the emulators; see README.md.
import { initializeApp, deleteApp } from "firebase/app"
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth"
import { getStorage, connectStorageEmulator, ref, uploadBytes, getBytes, list, deleteObject } from "firebase/storage"

const app = initializeApp({ apiKey: "demo-key", projectId: "demo-studio", storageBucket: "devdashboard-c9159-ca", appId: "x" })
const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
const st = getStorage(app); connectStorageEmulator(st, "127.0.0.1", 9199)
const stamp = Date.now()
const A = `sdk-a-${stamp}@example.test`, B = `sdk-b-${stamp}@example.test`
const a = (await createUserWithEmailAndPassword(auth, A, "password123")).user.uid
await signOut(auth)
await createUserWithEmailAndPassword(auth, B, "password123")
await signOut(auth)
async function as(email) { await signOut(auth); if (email) await signInWithEmailAndPassword(auth, email, "password123") }

// A fresh submission id per run, in newSubmissionId's shape, so "create"
// isn't refused as an overwrite of the last run's file.
const sid = (n) => `${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}-${(stamp + n).toString(16).slice(-8).padStart(8, "0")}`
const S1 = sid(1), S2 = sid(2), S3 = sid(3)
const video = new Uint8Array(4000), json = new TextEncoder().encode('{"a":1}')

let fail = 0
async function expectThat(expected, label, attempt) {
  let got
  try { await attempt(); got = "ALLOW" } catch (e) { got = e.code === "storage/unauthorized" ? "DENY" : `ERR ${e.code}` }
  if (got !== expected) fail++
  console.log(`${got === expected ? "ok  " : "FAIL"} ${label}: ${got}`)
}
const put = (path, data, contentType) => () => uploadBytes(ref(st, path), data, { contentType })

// /start: nobody signed in.
await as(null)
await expectThat("ALLOW", "signed out creates recording.webm", put(`studio/${S1}/recording.webm`, video, "video/webm"))
await expectThat("ALLOW", "signed out creates recording.mp4", put(`studio/${S2}/recording.mp4`, video, "video/mp4"))
await expectThat("DENY", "overwrite an existing recording", put(`studio/${S1}/recording.webm`, video, "video/webm"))
await expectThat("DENY", "request.json from a browser", put(`studio/${S3}/request.json`, json, "application/json"))
await expectThat("DENY", "html file", put(`studio/${S3}/x.html`, json, "text/html"))
await expectThat("DENY", "json named recording.webm", put(`studio/${S3}/recording.webm`, json, "application/json"))
await expectThat("DENY", "folder that isn't a submission id", put(`studio/not-an-id/recording.webm`, video, "video/webm"))
await expectThat("DENY", "upper-case hex in the id", put(`studio/${S3.toUpperCase()}/recording.webm`, video, "video/webm"))
await expectThat("DENY", "nested deeper", put(`studio/${S3}/x/y/recording.webm`, video, "video/webm"))
await expectThat("DENY", "outside studio", put(`other/${S3}/recording.webm`, video, "video/webm"))
await expectThat("DENY", "read a recording", () => getBytes(ref(st, `studio/${S1}/recording.webm`)))
await expectThat("DENY", "list studio/", () => list(ref(st, "studio/")))
await expectThat("DENY", "list a submission", () => list(ref(st, `studio/${S1}/`)))
await expectThat("DENY", "delete a recording", () => deleteObject(ref(st, `studio/${S1}/recording.webm`)))
// A signed-in browser gets nothing more.
await as(A)
await expectThat("DENY", "signed in reads a recording", () => getBytes(ref(st, `studio/${S1}/recording.webm`)))
await expectThat("DENY", "signed in overwrites a recording", put(`studio/${S1}/recording.webm`, video, "video/webm"))

// The old signed-in folders, kept until the migration is done.
await expectThat("ALLOW", "old: own recording", put(`studio/${a}/s1/recording.webm`, video, "video/webm"))
await expectThat("ALLOW", "old: own request.json", put(`studio/${a}/s1/request.json`, json, "application/json"))
await expectThat("ALLOW", "avatar (existing rule)", put(`users/${a}/a.png`, video, "image/png"))
await as(B)
await expectThat("DENY", "old: other user into A's folder", put(`studio/${a}/s1/recording.webm`, video, "video/webm"))
await as(null)
await expectThat("DENY", "old: signed out into A's folder", put(`studio/${a}/s1/recording.webm`, video, "video/webm"))

console.log(fail ? `${fail} FAILED` : "all passed")
await deleteApp(app); process.exit(fail ? 1 : 0)
