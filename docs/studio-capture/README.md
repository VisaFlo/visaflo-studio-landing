# Studio sign-in and sample capture

`/signin` and `/start` on studio.visaflo.ca let a firm sign in with their
VisaFlo account (or create one), record their face and voice, pick a topic,
and request a sample video.

## How it fits together

- **Accounts**: the VisaFlo production Firebase project (`devdashboard-c9159`),
  email and password plus the authenticator-app code, exactly like
  my.vflo.app. A VisaFlo customer signs in with the same email and password.
  Someone who creates an account here can later sign in to my.vflo.app with it.
  Sessions are per domain, so signing in on one site doesn't sign you in on
  the other.
- **Name**: read from the person's own `users/{uid}` document in the
  `ca-dryrun` database (the Firestore rules already allow that read). The firm
  name is asked once and kept in the browser.
- **Recording**: one vertical MediaRecorder clip of the script being read
  (MP4 on Safari and new Chrome, WebM elsewhere). A phone held upright
  records as is, in the phone's own portrait aspect; a laptop webcam's 16:9
  frame is cropped to its middle 9:16 column in the browser
  (`lib/studio/portrait.ts`), and the preview shows exactly that crop. MediaPipe Face Landmarker, loaded only on `/start`,
  runs the framing checks (face in the oval, distance, light) and starts the
  recording on a countdown; there is no head-turn step. If it can't load, the
  flow continues without live checks.
- **Files**: uploaded straight from the browser to
  `gs://devdashboard-c9159-ca/studio/{uid}/{submissionId}/`:
  `recording.{mp4,webm}` and `request.json` (topic, name, firm, consent text
  and time, live check results).
- **Notification**: `POST /api/studio/requests` checks the Firebase ID token
  against Google's public keys (no service account on Vercel), confirms the
  file sits under that uid, and emails the team inbox
  (`[VisaFlo Studio] New sample recording`) through the existing SendGrid key.

- **Admin**: `/admin` lists every submission (when, who, topic, length,
  check flags), including people who recorded but never picked a topic,
  with a **Download recording** button on each row that has a recording.
  A row opens its own page (`/admin/{uid}/{submissionId}`) with the
  recording playable, the consent text, the same download, and **Delete
  submission** (after a confirm, `DELETE /api/admin/submissions` removes
  every file in the folder for good and names any it couldn't). The file is
  saved as `{name-or-email-or-uid}-{submissionId}.{ext}`
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
  read field by field (`readRequestJson`), since the person's own browser
  wrote it. Sample videos are made by hand from the downloaded recording;
  the automatic pipeline that used to run from this page was removed in
  commit `45e5725` (2026-10-10; the history before it has the Remotion
  composition that matched the landing samples' look).

## Before it works in production

1. **Service account** (Vercel, Production and Preview):
   `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`, the `client_email` and
   `private_key` of a `devdashboard-c9159` service account key (the
   `firebase-adminsdk` one has the Storage and Firestore access it needs).
   Paste the key as it appears in the JSON file, `\n`s and all. Without them
   `/admin` says which variable is missing.
2. **Storage rules**: `storage.rules` from this folder is live on the
   `devdashboard-c9159-ca` bucket (published 2026-10-13, ruleset
   `28a27394…`; the one before it, with the admin read and write, was
   `148c885f…`). Publishing replaces the whole ruleset, so diff it against
   the live rules before publishing a change (they matched outside the
   studio blocks on 2026-10-13).
3. Nothing else: the web API key accepts requests from studio.visaflo.ca, and
   email and password sign-in doesn't need an authorized domain.

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

# Storage rules matrix (21 cases) against the running emulators
node docs/studio-capture/rules-test.mjs
```

After `rules-test.mjs` has run, `/admin` can be opened against the emulators
as `bkim@vflo.app` / `password123` (the script creates that account) once
its `users/{uid}` doc in the emulator's `ca-dryrun` database has
`master: true`; the dev server's admin routes use the emulators, not the
service account.

To walk the flow with a real VisaFlo account without writing to production,
set only `NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1`: sign-in and
the name lookup use production, uploads go to the local Storage emulator.

With `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST` set (ignored in production builds)
the app uses a `demo-studio` project id, so a missed emulator hookup fails
instead of reaching production. Without `SENDGRID_API_KEY`, the team email is
printed to the dev server log.
