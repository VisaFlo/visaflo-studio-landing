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
- **Recording**: one MediaRecorder clip from the start of the head turn to the
  end of the script (MP4 on Safari and new Chrome, WebM elsewhere). MediaPipe
  Face Landmarker, loaded only on `/start`, runs the framing checks and fills
  the ring as the head turns. If it can't load, the flow continues without
  live checks.
- **Files**: uploaded straight from the browser to
  `gs://devdashboard-c9159-ca/studio/{uid}/{submissionId}/`:
  `recording.{mp4,webm}` and `request.json` (topic, name, firm, consent text
  and time, live check results).
- **Notification**: `POST /api/studio/requests` checks the Firebase ID token
  against Google's public keys (no service account on Vercel), confirms the
  file sits under that uid, and emails the team inbox
  (`[VisaFlo Studio] New sample recording`) through the existing SendGrid key.

- **Admin**: `/admin` lists every submission (name, firm, email, topic,
  checks, consent) with the recording playable in the page, including people
  who recorded but never picked a topic. Only `bkim@vflo.app` with a verified
  email gets in (`lib/studio/admin.ts`, and the same email in
  `storage.rules`). `GET /api/admin/submissions` reads the bucket through the
  Firebase Storage API with that person's own ID token, so the storage rules
  decide access and there is still no service account. An unverified admin
  email gets a "Send verification email" button on the page.

## Before it works in production

1. **Storage rules** (Firebase console or CLI, project owner): publish
   `storage.rules` from this folder to the `devdashboard-c9159-ca` bucket. It
   is the live ruleset plus two `studio/` blocks (owner writes, admin reads);
   nothing else changes. Publishing replaces the whole ruleset, so diff it
   against the console's current rules first (it matched them on
   2026-10-08). Until then uploads fail with "We couldn't save your recording"
   and `/admin` says "Storage refused the read".
2. Nothing else: the web API key accepts requests from studio.visaflo.ca, and
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

# Storage rules matrix (20 cases, including the admin reads and writes) against the running emulators
node docs/studio-capture/rules-test.mjs
```

To walk the flow with a real VisaFlo account without writing to production,
set only `NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1`: sign-in and
the name lookup use production, uploads go to the local Storage emulator.

With `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST` set (ignored in production builds)
the app uses a `demo-studio` project id, so a missed emulator hookup fails
instead of reaching production. Without `SENDGRID_API_KEY`, the team email is
printed to the dev server log.
