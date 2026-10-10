# Studio sample video pipeline

Turn a face-and-voice recording submitted on studio.visaflo.ca into a 25-second
vertical news short in that person's own face and voice, from `/admin`, so we
can send it back and learn whether they would pay for it.

## Goal and scope

- Input: one submission folder `studio/{uid}/{submissionId}/` holding
  `recording.{mp4,webm}` (about 90 s, 1920×1080 webcam, the person reading a
  fixed script after a head turn) and `request.json` (topic, name, firm,
  consent).
- Output: `final.mp4`, 1080×1920, 22–28 s, the person speaking that week's
  real IRCC news in the chosen topic area, with karaoke captions, fact cards,
  background music and sound effects, like the samples on the landing page.
- Everything runs from `/admin`: the admin picks how the video is made,
  reviews the script, presses each stage, previews, then sends.
- Validation phase, so low volume (tens of videos), quality over automation.
  Each stage is its own button and can be re-run alone.

Out of scope for now: fully unattended one-click runs, consultants editing
their own scripts, posting to social accounts, Professional Voice Clone
(needs 30 min of audio we don't have).

## Tools and roles

| Tool | Role | Cost per video |
|---|---|---|
| Firebase Storage (`devdashboard-c9159-ca`) | All inputs, intermediates and the result live in the submission folder | — |
| `ffmpeg-static` in the API route | Extract a clean voice sample, pull candidate face frames, trim and crop the recording for method A | — |
| OpenAI **GPT-6 Sol** via Responses API + `web_search` filtered to `canada.ca` | Pick the week's news in the topic area, verify it, write the script and the fact cards | ≈ $0.05–0.15 |
| ElevenLabs Instant Voice Clone | One `voice_id` per person from the recording audio | plan |
| ElevenLabs TTS (`eleven_v4`, fallback `eleven_v3`) with timestamps | Speech in the cloned voice plus character timings → word timings for captions | ≈ $0.05 |
| ElevenLabs Music (`music_v2_5`, instrumental) | 30 s underscore | ≈ $0.08 |
| ElevenLabs Sound Effects | 2–3 short hits for card entrances | ≈ $0.12 |
| Higgsfield API — Seedance 2.5 reference-to-video | Method B: a new scene with the person talking (its audio is discarded) | ≈ $4.3 (sale) / $6.2 (list) for 30 s |
| fal.ai — `fal-ai/sync-lipsync/v2/pro` | Methods A and B: fit the mouth to the ElevenLabs speech | $5/min → ≈ $2.5 |
| fal.ai — `fal-ai/bytedance/omnihuman/v1.5` | Method C: one face image + speech → talking video in one step | $0.16/s → ≈ $4.8 |
| Remotion | Captions, cards, layout, music ducking, SFX, final render | — (Lambda ≈ $0.02) |
| Remotion Lambda (VisaFlo AWS) | Headless render from the API route | — |
| SendGrid, Mixpanel | Send the review link; track the "would you pay" buttons | — |

Generation cost per video: method A ≈ $3, B ≈ $7, C ≈ $5. Budget two
attempts per video.

Why these: ElevenLabs was decided; Higgsfield's API has no lipsync or avatar
endpoint and Seedance re-voices any audio reference in its own timing, so a
separate lipsync step is required to keep the cloned voice — fal hosts both
candidates behind one key. Remotion because captions and cards are React
components and the local ffmpeg has no drawtext filter. GPT-6 Sol because the
script's numbers and dates must be right and the Backend already standardises
on OpenAI; Luna is a tenth of the price but factuality matters more than cents
here.

## Architecture

```
/admin ──(admin ID token)──▶ /api/admin/sample/*  ──▶  ElevenLabs / OpenAI / fal / Higgsfield / Remotion Lambda
   ▲                               │
   └────── polls status.json ◀─────┴──▶ Firebase Storage: studio/{uid}/{submissionId}/sample/*
```

- The API routes authenticate exactly like `GET /api/admin/submissions`
  (`verifyIdToken`, `isStudioAdmin`, verified email) and read/write the bucket
  through the Storage REST API with the admin's own ID token. The storage rules
  gain `allow write` for the admin under `studio/**`; the owner's rule is
  unchanged. No service account.
- External jobs are asynchronous. A `start` route submits and records the job
  id in `status.json`; the client polls a `status` route every 5 s, which asks
  the provider and, once complete, copies the output into the folder and
  advances the stage. Vercel's 300 s default is enough for every copy.
- Files that external APIs must fetch (face frame, clip, speech, Seedance
  output) get a `firebaseStorageDownloadTokens` metadata token when uploaded,
  so their `?alt=media&token=` URL works as the public URL Higgsfield and fal
  require.
- Stages are independent and restartable. Re-running a stage marks the stages
  after it `stale`; the admin sees that and re-runs them.

### Folder layout

```
studio/{uid}/{submissionId}/sample/
  status.json          stage states, options, job ids, costs, voice_id
  voice-sample.wav     clean 60 s of the recording's audio
  face-1.jpg … face-5.jpg   candidate frames; status.json records the pick
  script.json          draft + approved script, cards, sources
  speech.mp3           TTS output
  words.json           word timings derived from character alignment
  clip.mp4             method A only: trimmed, cropped recording
  scene.mp4            method B only: Seedance output
  talking.mp4          lip-synced (A, B) or OmniHuman (C) video
  music.mp3, sfx-whoosh.mp3, sfx-pop.mp3
  final.mp4            Remotion render
  feedback.json        buttons pressed on the review page (phase 2)
```

`status.json`:

```ts
type SampleStatus = {
  options: {
    method: "real" | "scene" | "portrait"   // A, B, C
    background: "office" | "studio" | "street"   // B only
    layout: "boxed" | "full"                // boxed = 16:9 clip in a frame, full = 9:16 crop
    mood: "calm" | "energetic"
    faceFrame?: number                      // 1–5
    clipStart?: number                      // A: seconds into the recording, default 15
  }
  voiceId?: string
  stages: Record<Stage, {
    state: "idle" | "running" | "done" | "failed" | "stale"
    job?: { provider: "fal" | "higgsfield" | "remotion"; id: string; step?: "scene" | "lipsync" }
    error?: string
    startedAt?: string; finishedAt?: string
    cost?: number
  }>
}
type Stage = "prep" | "script" | "voice" | "video" | "audio" | "render" | "send"
```

### Routes

All under `/api/admin/sample/`, JSON, `{ id }` = `{uid}/{submissionId}`.

| Route | Does |
|---|---|
| `GET status?id` | Returns `status.json` (creates a default one) |
| `PUT options` | Saves `options` |
| `POST prep` | ffmpeg: `voice-sample.wav` (recording audio, 15 s–75 s, mono 44.1 kHz), five frames at 30/45/60/75/90 % |
| `POST script` | GPT-6 Sol → `script.json` draft. Body may carry `notes` (admin steer) |
| `PUT script` | Saves the admin's edits and `approved: true` |
| `POST voice` | IVC if no `voiceId` for this uid yet; TTS with timestamps → `speech.mp3`, `words.json` |
| `POST video/start` | A: ffmpeg clip → fal lipsync. B: Higgsfield Seedance. C: fal OmniHuman |
| `GET video/status?id` | Polls fal/Higgsfield; for B, when Seedance finishes, submits lipsync and keeps polling; copies `talking.mp4` |
| `POST audio` | ElevenLabs Music + 2 SFX |
| `POST render/start` | Remotion Lambda `renderMediaOnLambda` with the composition props |
| `GET render/status?id` | `getRenderProgress`; copies `final.mp4` |
| `POST send` | Phase 2: SendGrid email with the review link, marks `send` done |

Each route checks the stages it depends on are `done`, flips its stage to
`running`, and on any thrown error writes `failed` with a short message the
admin can read (provider status + first 300 chars). Provider costs come from
the pricing table and are written into `cost` so the row can show "spent so
far".

### `/admin` UI

The submission detail gains a **Make sample** panel under the recording:

1. **Settings** — method (A/B/C with one-line descriptions and the price),
   lipsync model, background (B), layout, mood; method A also shows a
   clip-start field. Saved on change. After Prep, methods B and C show the
   five face frames; click to pick.
2. **Generate** — one button runs Prep → Script → Voice → Video → Audio →
   Render in order (`lib/studio/sample/auto.ts` decides the next step from
   `status.json`: the first stage not `done`, if nothing blocks it). Under
   it, a six-segment progress bar and the step list, each with state,
   elapsed time, cost and the error text when failed. The run stops — with
   the reason under the button — when a step fails, when B/C has no face
   frame yet, or when a GPT draft isn't approved; the button then reads
   Continue (or Retry) and picks up from the first unfinished step. "Stop
   after this step" ends the run early. A finished step has a "Redo" link;
   redoing marks the steps built on it `stale`, which Continue reruns.
3. **Script editor** — headline, lines (tts text and caption text side by
   side), cards, sources with links, GPT's fact list. Save, Approve. The
   topic's fixed script arrives approved; a "GPT draft" (button in the
   Script card) does not, and Voice waits until it is. The `notes` steer is
   API-only.
4. **Outputs** — audio player for `speech.mp3`, video players for
   `talking.mp4` and `final.mp4`.

The panel polls `GET poll` every 5 s while any stage is `running`; with
Generate on, each new status starts the next step.

## Stages in detail, with prompts

### 1. Prep (ffmpeg)

- `ffmpeg -i recording -ss 15 -t 60 -vn -ac 1 -ar 44100 voice-sample.wav` —
  skips the head turn and the first line, keeps one minute of reading.
- Frames: `-ss {t} -frames:v 1 -q:v 2 face-N.jpg` at 30/45/60/75/90 % of the
  duration. The admin picks the one with the best light and a closed mouth.
- Method A clip is made at video start, not here, because it depends on the
  speech length: `-ss {clipStart} -t {ceil(speechSeconds)+1}`; for `layout:
  full` also `-vf crop=608:1080:656:0,scale=1080:1920`.

### 2. Script

**Default: one fixed script per topic.** Decided 2026-10-09 while building:
everyone who picks a topic gets the same pre-checked script, so the stage is
instant, free and consistent with the landing page. The five scripts live in
`lib/studio/sample/scripts.ts` and are the landing-sample scripts
(Express Entry draw, work-permit study measure, study-permit proof of funds,
PGP pause + super visa, and a general PR-backlog script for "own topic").
They start approved; the admin can still edit or un-approve in `/admin`.

**Opt-in: GPT-6 Sol writes a fresh one** (`source: "gpt"` on the Script
run) for this week's news. That draft starts unapproved. Details:

Responses API, `model: "gpt-6-sol"`, `reasoning: { effort: "medium" }`,
`tools: [{ type: "web_search", filters: { allowed_domains: ["canada.ca"] } }]`,
`include: ["web_search_call.action.sources"]`, structured output with the
schema below. Expected cost $0.05–0.15.

System prompt:

```
You write 25-second vertical news shorts for licensed Canadian immigration
consultants. The consultant appears on camera (AI-generated with their written
consent) and speaks your script in their own cloned voice. Viewers are
prospective immigrants and their families; they want to know what changed and
what to do.

Rules
- 65 to 85 words total. Read aloud at a brisk news pace that is 22 to 28 s.
- Shape: one-line hook stating the change in plain words → what exactly changed
  (numbers, dates, who is affected) → what it means or one action to take →
  one-line sign-off inviting viewers to follow for next week's update.
- First person, straight to camera, plain English, short sentences. No
  greeting, no self-introduction, no firm name, no jargon, no legal advice
  beyond "check with a licensed professional".
- Every number, date, program name and quote must appear on a canada.ca page
  you actually read in this session. Do not round, convert, infer or carry
  over from memory. If a figure is not on the page, leave it out.
- Write the acronym as "I-R-C-C" in tts_text and "IRCC" in caption_text.
  Spell out other acronyms the first time.
- tts_text may use at most two ElevenLabs delivery tags in the whole script,
  chosen from [confident] [serious] [warm] [pause], placed at the start of a
  line. caption_text never contains tags and matches the spoken words exactly.
- Cards: 2 to 4 facts worth seeing on screen (a number, a date, a group of
  people). value is at most 12 characters and must stand on one line; label is
  at most 28 characters; sub is optional, at most 40. Each card points at the
  line during which it should appear.
- Return JSON only.
```

User prompt:

```
Topic area: {topic.detail}            e.g. "Study permits"
Consultant's own topic, if any: {request.ownTopic or "none"}
Today: {YYYY-MM-DD}
Admin notes: {notes or "none"}

Search canada.ca for the most recent official IRCC / Government of Canada
change or announcement in this area. Prefer the last 14 days; otherwise the
most recent you can find. Read the page(s), then write the script.
```

Output schema (`strict: true`):

```json
{
  "headline": "string, under 60 chars, what changed",
  "published": "YYYY-MM-DD of the source",
  "lines": [{ "tts_text": "string", "caption_text": "string" }],
  "cards": [{ "line": 0, "label": "string", "value": "string", "sub": "string|null" }],
  "sources": [{ "url": "https://www.canada.ca/...", "title": "string" }],
  "facts": [{ "claim": "string", "source_url": "string" }],
  "estimated_seconds": 25
}
```

The admin sees sources and facts next to the lines and fixes anything wrong
before approving. Re-running Script through the API with `notes` ("use the November draw",
"shorter") is the steer.

### 3. Voice (ElevenLabs)

Instant Voice Clone, once per uid (`voiceId` is stored in `status.json` and
reused by later submissions from the same person):

```
POST /v1/voices/add  multipart
  name: studio-{uid}
  description: Immigration consultant, webcam recording, studio.visaflo.ca
  files: voice-sample.wav
  remove_background_noise: true
  labels: {"use_case":"news"}
```

TTS with timestamps:

```
POST /v1/text-to-speech/{voiceId}/with-timestamps?output_format=mp3_44100_128
  model_id: eleven_v4          (fallback eleven_v3, then eleven_multilingual_v2
                                if GET /v1/models says v4 can't do this endpoint)
  text: lines.map(l => l.tts_text).join("\n\n")
  voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2,
                    speed: 1.05, use_speaker_boost: true }
  apply_text_normalization: "on"
```

`words.json` is built from `normalized_alignment` (fallback `alignment`):
group characters into words on whitespace, drop tag text in brackets, map
each word to its line by walking `caption_text` word counts. Shape:
`[{ word, start, end, line }]`. If the audio runs over 30 s the stage fails
with "script too long" so the admin trims before spending on video.

### 4. Video

Length = `ceil(speechSeconds) + 1`, capped at 30.

**A — real footage (`method: real`)**: ffmpeg clip as in Prep, uploaded as
`clip.mp4` with a download token. Then

```
fal queue  fal-ai/sync-lipsync/v2/pro
  video_url: clip.mp4 URL
  audio_url: speech.mp3 URL
  sync_mode: "cut_off"
```

**B — new scene (`method: scene`)**: Higgsfield Seedance 2.5, then the same
lipsync call on `scene.mp4`.

```
POST https://api.higgsfield.ai/bytedance/seedance-2.5/reference-to-video
  image_urls: [face-N.jpg URL]
  audio_urls: [speech.mp3 URL]        gives the mouth roughly the right rhythm; its audio is discarded
  duration: {length}   resolution: "720p"   aspect_ratio: "9:16"
  bitrate_mode: "standard"   generate_audio: true
  prompt: see below
```

Scene prompt, `{background}` from the option:

```
The person from the reference image, an immigration consultant, speaks
directly to the camera like a confident, friendly news presenter, following
the reference audio. Medium close-up, head and shoulders, centred, generous
headroom so the top third of the frame stays empty for on-screen cards.
Natural small hand gestures, steady locked-off camera, soft even key light,
shallow depth of field. Background: {background}. Keep the person's face,
hair, skin tone and glasses exactly as in the reference. No on-screen text,
no captions, no logos, no other people, no camera movement.

office  → "a bright modern office with large windows and soft daylight, blurred"
studio  → "a clean neutral studio with a soft warm-grey gradient backdrop"
street  → "a downtown Canadian street at golden hour, softly blurred"
```

**C — portrait (`method: portrait`)**:

```
fal queue  fal-ai/bytedance/omnihuman/v1.5
  image_url: face-N.jpg URL
  audio_url: speech.mp3 URL
  resolution: "720p"              (1080p caps audio at 30 s; 720p is also faster)
  prompt: "The person speaks to camera as a calm, confident news presenter,
           natural subtle hand gestures, steady framing, no camera movement,
           no text on screen."
```

All three end with `talking.mp4` in the folder. Its audio track is ignored by
Remotion; `speech.mp3` is the voice.

### 5. Audio (ElevenLabs)

Music, `POST /v1/music`, `model_id: music_v2_5`, `force_instrumental: true`,
`music_length_ms: (speechSeconds + 3) * 1000`:

```
calm      → "Understated modern news-brief underscore: soft electric piano
             chords, light brushed percussion, subtle synth pulse, steady
             medium tempo around 95 BPM, trustworthy and optimistic,
             instrumental only, leaves space for a speaking voice, clean
             ending."
energetic → "Bright modern news-brief underscore: crisp electronic drums,
             plucked synth motif, warm bass, around 115 BPM, confident and
             forward-moving, instrumental only, leaves space for a speaking
             voice, clean ending."
```

Sound effects, `POST /v1/sound-generation`, `prompt_influence: 0.6`:

```
sfx-whoosh  duration 0.7  "short soft whoosh with a subtle click, clean UI
                            transition, no reverb"
sfx-pop     duration 0.5  "gentle single pop, notification tick, soft, dry"
```

### 6. Render (Remotion)

Composition `Sample`, 1080×1920, 30 fps, duration = speech + 1.5 s tail.
Props: `talkingUrl, speechUrl, musicUrl, sfx, words, cards, lines, layout,
headline`.

- **Layout** `full`: `talking.mp4` fills the frame. `boxed` (default for A):
  the 16:9 clip sits in a rounded frame in the middle band; cards above,
  captions below.
- **Captions**: groups of 3–5 words from `words.json`, lower third, 120 px
  safe margin, current word highlighted (weight + colour), group swaps on the
  first word of the next group. Text from `caption_text`, never from the TTS
  text.
- **Cards**: appear on the first word of their `line` (with `sfx-pop`), slide
  in from above with `sfx-whoosh` on the first card, stack up to 3 in the top
  headroom, each built label → value → sub over 400 ms. Rules carried from
  the landing samples: never show an empty card, value never wraps (shrink
  font until one line), cards never cover the face (top band only; in `full`
  layout the band is the top 28 %).
- **Audio**: `speech.mp3` at 0 dB, music at −16 dB with a 1 s fade in and a
  1.5 s fade out, music ducked a further −4 dB while a word is active; the
  video's own track is muted.
- **Headline** strip for the first 2.5 s under the top band.

Render path: `renderMediaOnLambda` into the VisaFlo AWS account
(`npx remotion lambda` deploy once; `REMOTION_AWS_*` env), output copied to
`final.mp4`. Local fallback for the first videos:
`npm run sample:render -- {id}` renders the same composition with
`@remotion/renderer` from the dev machine.

### 7. Send (phase 2)

SendGrid email from the existing key to `request.email` with a link to
`studio.visaflo.ca/sample/{token}`; the page shows `final.mp4` and three
buttons — "I'd use this", "I'd pay for weekly videos", "Not for me" — each
written to `feedback.json` through `POST /api/sample/feedback` and tracked in
Mixpanel as `sample_feedback`. The token is a random id stored in
`status.json`; the route resolves it to the folder.

## Error handling

- Provider errors: status and first 300 chars into `stages[x].error`; stage
  `failed`; the Generate button becomes Retry. Nothing downstream can run.
- Timeouts: a job still running after 15 min (Seedance, lipsync, OmniHuman) or
  10 min (render) is marked `failed: "timed out; retry"`; the provider's own
  retention means a late result is just lost, not billed twice unless retried.
- Script too long (> 30 s of speech) fails Voice before any video spend.
- Storage rules not published: the read/write returns 401/403 → the panel
  shows the same "Publish the latest storage.rules" message the list uses.
- Re-running a stage marks downstream stages `stale`; their outputs stay in
  the folder until regenerated.

## Testing

- Unit: character alignment → `words.json` (tags stripped, line mapping,
  normalisation differences), script schema validation, stage dependency and
  stale marking, cost table arithmetic.
- Storage rules matrix (`docs/studio-capture/rules-test.mjs`): admin write
  under `studio/**` allowed, other users' writes outside their own folder
  still denied.
- Remotion: `npx remotion studio` with a fixture props file for the
  composition; a rendered fixture checked by eye for caption timing, card
  placement and one-line values.
- End-to-end on one real submission with methods A and B, compared side by
  side before choosing a default. The first run also answers how much of the
  accent the clone keeps.

## Configuration

```
OPENAI_API_KEY            copied from Backend/.env
ELEVENLABS_API_KEY
FAL_KEY
HIGGSFIELD_KEY_ID, HIGGSFIELD_KEY_SECRET      from open.higgsfield.ai (USD balance, separate from the web plan)
REMOTION_AWS_ACCESS_KEY_ID, REMOTION_AWS_SECRET_ACCESS_KEY, REMOTION_FUNCTION_NAME, REMOTION_SERVE_URL, REMOTION_REGION
```

Storage rules: add `allow write` for the admin email under
`/studio/{allPaths=**}`; publish together with the code.

## Decisions still open

1. Default method once A and B have been compared on a real submission.
2. Remotion Lambda in the VisaFlo AWS account versus rendering locally for
   the first batch. Lambda is the plan; local is the fallback if AWS access
   is slow to arrange.
3. Seedance 480p pricing on the API (the web plan charged less than half for
   480p; the public API page lists one rate). Check in the console; 480p
   upscaled was fine for the landing samples.
