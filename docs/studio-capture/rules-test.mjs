// Storage rules matrix for studio/{uid}/... Run against the emulators; see README.md.
import { initializeApp, deleteApp } from "firebase/app"
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } from "firebase/auth"
import { getStorage, connectStorageEmulator, ref, uploadBytes, getBytes } from "firebase/storage"

const app = initializeApp({ apiKey: "demo-key", projectId: "demo-studio", storageBucket: "devdashboard-c9159-ca", appId: "x" })
const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
const st = getStorage(app); connectStorageEmulator(st, "127.0.0.1", 9199)
const stamp = Date.now()
const a = (await createUserWithEmailAndPassword(auth, `sdk-a-${stamp}@example.test`, "password123")).user.uid
await signOut(auth)
await createUserWithEmailAndPassword(auth, `sdk-b-${stamp}@example.test`, "password123")
await signOut(auth)
const video = new Uint8Array(4000), json = new TextEncoder().encode('{"a":1}')
async function as(uidEmail) { await signOut(auth); if (uidEmail) await (await import("firebase/auth")).signInWithEmailAndPassword(auth, uidEmail, "password123") }
const cases = [
  ["ALLOW", "own recording.webm", `sdk-a-${stamp}@example.test`, `studio/${a}/s1/recording.webm`, video, "video/webm"],
  ["ALLOW", "own recording.mp4", `sdk-a-${stamp}@example.test`, `studio/${a}/s1/recording.mp4`, video, "video/mp4"],
  ["ALLOW", "own request.json", `sdk-a-${stamp}@example.test`, `studio/${a}/s1/request.json`, json, "application/json"],
  ["ALLOW", "overwrite own recording", `sdk-a-${stamp}@example.test`, `studio/${a}/s1/recording.webm`, video, "video/webm"],
  ["ALLOW", "avatar (existing rule)", `sdk-a-${stamp}@example.test`, `users/${a}/a.png`, video, "image/png"],
  ["DENY", "other user into A's folder", `sdk-b-${stamp}@example.test`, `studio/${a}/s1/recording.webm`, video, "video/webm"],
  ["DENY", "signed out", null, `studio/${a}/s1/recording.webm`, video, "video/webm"],
  ["DENY", "html file", `sdk-a-${stamp}@example.test`, `studio/${a}/s1/x.html`, json, "text/html"],
  ["DENY", "video named request.json", `sdk-a-${stamp}@example.test`, `studio/${a}/s1/request.json`, video, "video/webm"],
  ["DENY", "json named recording.webm", `sdk-a-${stamp}@example.test`, `studio/${a}/s1/recording.webm`, json, "application/json"],
  ["DENY", "nested deeper", `sdk-a-${stamp}@example.test`, `studio/${a}/s1/x/recording.webm`, video, "video/webm"],
  ["DENY", "outside studio", `sdk-a-${stamp}@example.test`, `other/${a}/x.webm`, video, "video/webm"],
  ["DENY", "70KB request.json", `sdk-a-${stamp}@example.test`, `studio/${a}/s1/request.json`, new Uint8Array(70000), "application/json"],
]
let fail = 0
for (const [expect, label, who, path, data, contentType] of cases) {
  await as(who)
  let got
  try { await uploadBytes(ref(st, path), data, { contentType }); got = "ALLOW" } catch (e) { got = e.code === "storage/unauthorized" ? "DENY" : `ERR ${e.code}` }
  if (got !== expect) fail++
  console.log(`${got === expect ? "ok  " : "FAIL"} ${label}: ${got}`)
}
await as(`sdk-a-${stamp}@example.test`)
try { await getBytes(ref(st, `studio/${a}/s1/recording.webm`)); console.log("FAIL read own: ALLOW"); fail++ } catch (e) { console.log(`ok   read own: ${e.code === "storage/unauthorized" ? "DENY" : e.code}`) }
console.log(fail ? `${fail} FAILED` : "all passed")
await deleteApp(app); process.exit(fail ? 1 : 0)
