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
- **Recording**: one vertical (9:16) MediaRecorder clip of the script being
  read (MP4 on Safari and new Chrome, WebM elsewhere). A phone held upright
  records as is; a laptop webcam's 16:9 frame is cropped to its middle 9:16
  column in the browser (`lib/studio/portrait.ts`), and the preview shows
  exactly that crop. MediaPipe Face Landmarker, loaded only on `/start`,
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

- **Admin**: `/admin` lists every submission (name, firm, email, topic,
  checks, consent) with the recording playable in the page, including people
  who recorded but never picked a topic. Only `bkim@vflo.app` with a verified
  email gets in (`lib/studio/admin.ts`, and the same email in
  `storage.rules`). `GET /api/admin/submissions` reads the bucket through the
  Firebase Storage API with that person's own ID token, so the storage rules
  decide access and there is still no service account. An unverified admin
  email gets a "Send verification email" button on the page.

- **Sample pipeline**: on a submission's own page (`/admin/{uid}/{submissionId}`,
  reached from the `/admin` list), one **Generate** button runs the six
  steps in order and shows each one's state, time and cost as it goes:
  Prep (ffmpeg: voice sample + face frames) → Script (the topic's fixed,
  pre-checked script from `lib/studio/sample/scripts.ts`, already approved)
  → Voice (ElevenLabs clone + TTS with word timings) → Video (A: own
  footage + fal lipsync, B: Higgsfield Seedance + lipsync, C: fal OmniHuman)
  → Audio (ElevenLabs music + SFX) → Render (Remotion Lambda when the
  `REMOTION_*` keys are set; otherwise the dev server runs
  `npm run sample:render` on this machine with its Chrome, log in
  `$TMPDIR/visaflo-render-<uid>-<submissionId>.log`; on Vercel without
  Lambda it only writes `render-props.json` for someone to run that command
  by hand). The run stops, with the reason under
  the button, when a step fails, when method B or C still needs a face
  frame picked, or when a GPT draft (the "GPT draft" button in the Script
  card asks GPT-6 Sol for a fresh script from canada.ca) hasn't been
  approved; "Continue" picks up from there. "Redo" on a finished step runs
  it again and marks the steps built on it stale. Everything is written to
  `{submissionId}/sample/`, with `status.json` as the ledger (stage states,
  job ids, costs). Design and prompts:
  `docs/superpowers/specs/2026-10-09-studio-sample-pipeline-design.md`.
  Keys: `OPENAI_API_KEY`, `ELEVENLABS_API_KEY` (Starter plan or higher for
  voice cloning), `FAL_KEY`, `HIGGSFIELD_KEY_ID/SECRET`, `REMOTION_*`.
  `npm run remotion:fixtures && npm run remotion:studio` previews the
  composition with synthetic media.

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
