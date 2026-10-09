"use client"

// Thin wrapper over the browser's speech recognition (Chrome, Edge, Safari
// on Mac). Used only to light up script words as they're read; nothing is
// stored. Chrome runs it on-device when the language pack is installed and
// otherwise uses Google's speech service, like any web dictation.

type RecognitionAlternative = { transcript: string }
type RecognitionResult = { isFinal: boolean; 0: RecognitionAlternative }
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> }
type RecognitionErrorEvent = { error: string }

type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  processLocally?: boolean
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type RecognitionCtor = (new () => Recognition) & {
  available?: (options: { langs: string[]; processLocally: boolean }) => Promise<string>
}

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// On iPhone and iPad, speech recognition takes over the audio session and can
// silence the recording, so the script falls back to voice-activity pacing.
function isIos(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
}

export function speechRecognitionSupported(): boolean {
  return Boolean(recognitionCtor()) && !isIos()
}

export type RecognizerHandle = { stop: () => void }

/**
 * Starts continuous recognition. `onFinal` gets each finished phrase once;
 * `onInterim` gets the current unfinished phrase (replaced on every update).
 * `onFail` fires if recognition can't run (blocked, no service); the caller
 * then falls back.
 */
export function startRecognizer(handlers: {
  onFinal: (text: string) => void
  onInterim: (text: string) => void
  onFail: (reason: string) => void
}): RecognizerHandle | null {
  const Ctor = recognitionCtor()
  if (!Ctor || isIos()) return null

  let stopped = false
  let rec: Recognition | null = null
  let quickEnds = 0
  let startedAt = 0
  let local = false

  const launch = () => {
    if (stopped) return
    const r = new Ctor()
    r.lang = "en-US"
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 1
    if (local && "processLocally" in r) r.processLocally = true
    r.onresult = (event) => {
      quickEnds = 0
      let interim = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) handlers.onFinal(result[0].transcript)
        else interim += result[0].transcript + " "
      }
      handlers.onInterim(interim.trim())
    }
    r.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return
      stopped = true
      handlers.onFail(event.error)
    }
    // Chrome ends continuous sessions after a while or a long pause; start a
    // new one. Repeated instant ends mean it isn't working at all.
    r.onend = () => {
      if (stopped) return
      quickEnds = performance.now() - startedAt < 1500 ? quickEnds + 1 : 0
      if (quickEnds >= 4) {
        stopped = true
        handlers.onFail("ended")
        return
      }
      window.setTimeout(launch, 150)
    }
    rec = r
    startedAt = performance.now()
    try {
      r.start()
    } catch {
      stopped = true
      handlers.onFail("start")
    }
  }

  // Prefer on-device recognition where Chrome already has the model.
  const checkLocal = Ctor.available
    ? Ctor.available({ langs: ["en-US"], processLocally: true }).then((s) => s === "available")
    : Promise.resolve(false)
  void checkLocal
    .catch(() => false)
    .then((isLocal) => {
      local = isLocal
      launch()
    })

  return {
    stop: () => {
      stopped = true
      try {
        rec?.abort()
      } catch {}
    },
  }
}
