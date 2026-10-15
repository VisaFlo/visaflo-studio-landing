# Studio sample capture

`/start` on studio.visaflo.ca lets a firm record their face and voice, pick a
topic, and request a sample video. Nobody signs in: the person types their
email, first and last name and firm name, which stay in that browser
(`lib/studio/profile.ts`). Sign-in (`/signin`) is only for `/admin`; a plain
`/signin` link (older emails) redirects to `/start`.

## How it fits together

- **Portrait photo**: first, one still of the same vertical frame
  (`lib/studio/photo.ts`), taken from the same framing check as the video
  (no countdown), reviewed, then kept in IndexedDB with the take until sent.
  Uploaded as `photo.jpg` (JPEG) next to the recording.
- **Recording**: one vertical MediaRecorder clip of the short script (about
  30 seconds, `lib/studio/content.ts`) being read
  (MP4 on Safari and new Chrome, WebM elsewhere). A phone held upright
  records as is, in the phone's own portrait aspect; a laptop webcam's 16:9
  frame is cropped to its middle 9:16 column in the browser
  (`lib/studio/portrait.ts`), and the preview shows exactly that crop. MediaPipe Face Landmarker, loaded only on `/start`,
  runs the framing checks (face centred, distance, light). Recording starts
  on a full-screen countdown, with the script at the top and a face oval to
  stay in; there is no head-turn step. If MediaPipe can't load, the flow
  continues without live checks.
- **Files**: when the person presses **Make my sample** (on the last screen,
  with the consent box; nothing goes up before), the browser uploads
  `photo.jpg` and `recording.{mp4,webm}` straight to
  `gs://devdashboard-c9159-ca/studio/{submissionId}/` (the id is the UTC time
  plus 8 hex characters, `SUBMISSION_ID` in `lib/studio/project.ts`). The
  storage rules let a signed-out browser create those two files and nothing
  else: no overwrite, no `request.json`, no reading, listing or deleting.
  Pressing **Make my sample** again after a failure re-sends only the file
  that failed; after a refusal (the file may be there already, its reply
  lost) it starts a new folder (`lib/studio/upload-plan.ts`).
- **Notification**: `POST /api/studio/requests` checks the recording (and the
  photo, when the page sends one) are in the bucket, writes `request.json`
  next to them with the service account
  (email, first and last name, firm, topic, consent text and time, live check
  results), and emails the team inbox (`[VisaFlo Studio] New sample
  recording`, with a link to the submission in `/admin`) through the existing
  SendGrid key. `request.json` is created only once, so a second send of the
  same submission isn't mailed again; if the email fails, `request.json` is
  removed so a retry sends it. The email is typed, never verified.

- **Admin**: `/admin` lists every submission (when, who, topic, length,
  check flags), including uploads whose request never went through (and
  older ones from before a topic was picked), with **Download video** and **Download photo** buttons on each row that
  has them (`/api/admin/recording?id=…`, `&file=photo` for the photo).
  A row opens its own page (`/admin/{submissionId}`) with the
  recording playable, the consent text, the same downloads, and **Delete
  submission** (after a confirm, `DELETE /api/admin/submissions` removes
  every file in the folder for good and names any it couldn't). The file is
  saved as `{name-or-email}-{submissionId}.{ext}`
  (`GET /api/admin/recording` streams it through the server, because the
  bucket serves it inline and a cross-origin link can't force a download).
  Anyone VisaFlo marked as a master gets in: `master: true` on their
  `users/{uid}` doc in the `ca-dryrun` database, or the legacy `'master'`
  role entry, the same rule as the backend's `isMaster`
  (`lib/studio/admin-auth.ts`). The admin routes check that with the
  server's service account (`FIREBASE_CLIENT_EMAIL` and
  `FIREBASE_PRIVATE_KEY`, `lib/studio/admin-firebase.ts`) and then use the
  same account for the bucket, which bypasses the storage rules; no browser
  token can read `studio/`. Storage rules can't make that check themselves,
  since they only see the `(default)` Firestore database. `request.json` is
  read field by field (`readRequestJson`), since its fields came from a
  browser nobody signed into (older ones were written by the browser itself
  and carry the person's VisaFlo `uid`, shown on their page). Sample videos are made by hand from the downloaded recording;
  the automatic pipeline that used to run from this page was removed in
  commit `45e5725` (2026-10-10; the history before it has the Remotion
  composition that matched the landing samples' look).

## Moving from studio/{uid}/{submissionId}/ (2026-10)

Until 2026-10, `/start` needed a VisaFlo sign-in and kept each submission
under the person's uid. `scripts/migrate-studio-paths.mjs` moves those
folders to `studio/{submissionId}/` (copy, check md5 and size, then delete
the original; safe to run again):

```bash
node --env-file=.env.local scripts/migrate-studio-paths.mjs           # dry run
node --env-file=.env.local scripts/migrate-studio-paths.mjs --apply
```

Order: publish `storage.rules` (it keeps the old signed-in rule for pages
opened before the release), deploy, run the script, and a few days later run
it once more, then drop the old rule. `/admin` skips any folder that isn't a
submission id, so an unmoved one is logged rather than shown broken.

## Before it works in production

1. **Service account** (Vercel, Production and Preview):
   `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`, the `client_email` and
   `private_key` of a `devdashboard-c9159` service account key (the
   `firebase-adminsdk` one has the Storage and Firestore access it needs).
   Paste the key as it appears in the JSON file, `\n`s and all. Without them
   `/admin` and `POST /api/studio/requests` say which variable is missing.
2. **Storage rules**: `storage.rules` from this folder is live on the
   `devdashboard-c9159-ca` bucket (published 2026-10-13, ruleset
   `28a27394…`; the one before it, with the admin read and write, was
   `148c885f…`). Publishing replaces the whole ruleset, so diff it against
   the live rules before publishing a change (they matched outside the
   studio blocks on 2026-10-13).
3. Nothing else: the web API key accepts requests from studio.visaflo.ca, and
   email and password sign-in (for `/admin`) doesn't need an authorized domain.

## Local QA without touching production

```bash
# Terminal 1: Auth, Storage and Firestore emulators with the new rules
cd docs/studio-capture && cat > firebase.json <<'JSON'
{ "storage": { "rules": "storage.rules" },
  "emulators": { "auth": { "port": 9099 }, "storage": { "port": 9199 },
                 "firestore": { "port": 8080 }, "ui": { "enabled": false } } }
JSON
firebase emulators:start --only auth,storage,firestore --project demo-studio

# Terminal 2: the app, pointed at the emulators (dev builds only)
NEXT_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1 npm run dev

# Storage rules matrix against the running emulators
node docs/studio-capture/rules-test.mjs
```

After `rules-test.mjs` has run, `/admin` can be opened against the emulators
as `bkim@vflo.app` / `password123` (the script creates that account) once
its `users/{uid}` doc in the emulator's `ca-dryrun` database has
`master: true`; the dev server's admin routes use the emulators, not the
service account.

To try `/admin` with a real VisaFlo master account without touching
production files, set only `NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1`:
sign-in uses production, the bucket is the local Storage emulator.

With `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST` set (ignored in production builds)
the app uses a `demo-studio` project id, so a missed emulator hookup fails
instead of reaching production. Without `SENDGRID_API_KEY`, the team email is
printed to the dev server log.
