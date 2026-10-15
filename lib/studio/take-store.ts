"use client"

// Keeps the current take in IndexedDB while it records (one-second chunks),
// so a reload, a closed tab or a crashed browser doesn't throw away the
// reading, and the portrait photo once it's kept. One of each per browser. A
// new take or Start over replaces the take; both go once the request is sent
// or the person begins a new sample. Storage failures (private mode, quota)
// are only logged: the flow carries on, and a reload finds less.

import type { Check, RecordingChecks } from "@/lib/studio/checks"

const DB_NAME = "vf-studio"
const TAKES = "takes"
const CHUNKS = "chunks"

export type StoredTake = {
  /** The store's key: OWNER. (It was the account's uid while /start needed sign-in.) */
  uid: string
  takeId: string
  mime: string
  source: "camera"
  startedAt: number
  /**
   * Set once Finish completed; absent when the page closed mid-recording
   * (then nothing was measured). `cutOff` is the recorder's verdict that the
   * take ended early, kept so a reload tells the same story; it is absent
   * only on takes stored before it existed, read as not cut off.
   */
  finished?: { seconds: number; checks: RecordingChecks; cutOff?: boolean }
}

// Nobody signs in on /start, so the one take kept is this browser's. The
// photo shares the takes store under its own key (no schema change).
const OWNER = "device"
const PHOTO = "device-photo"

export type StoredPhoto = { uid: typeof PHOTO; blob: Blob; width: number; height: number; faceSeen: Check }

let opening: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(TAKES, { keyPath: "uid" })
      req.result.createObjectStore(CHUNKS)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  opening.catch(() => {
    opening = null
  })
  return opening
}

function run<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => IDBRequest<T> | void) {
  return db().then(
    (d) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = d.transaction(stores, mode)
        const req = work(tx)
        tx.oncomplete = () => resolve(req ? req.result : undefined)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

// Storage is a safety net: if it fails (private mode, quota), recording
// carries on as before.
function quietly<T>(promise: Promise<T>): Promise<T | undefined> {
  return promise.catch((error) => {
    console.warn("Take storage unavailable", error)
    return undefined
  })
}

export function beginTake(take: Omit<StoredTake, "uid">): Promise<unknown> {
  return quietly(
    clearTake().then(() => run([TAKES], "readwrite", (tx) => tx.objectStore(TAKES).put({ ...take, uid: OWNER }))),
  )
}

export function saveChunk(takeId: string, index: number, chunk: Blob): Promise<unknown> {
  return quietly(run([CHUNKS], "readwrite", (tx) => tx.objectStore(CHUNKS).put(chunk, [takeId, index])))
}

export function finishTake(finished: NonNullable<StoredTake["finished"]>): Promise<unknown> {
  return quietly(
    run<StoredTake>([TAKES], "readonly", (tx) => tx.objectStore(TAKES).get(OWNER)).then((take) =>
      take ? run([TAKES], "readwrite", (tx) => tx.objectStore(TAKES).put({ ...take, finished })) : undefined,
    ),
  )
}

export async function loadTake(): Promise<{ take: StoredTake; blob: Blob; chunks: number } | null> {
  const take = await quietly(run<StoredTake>([TAKES], "readonly", (tx) => tx.objectStore(TAKES).get(OWNER)))
  if (!take) return null
  const range = IDBKeyRange.bound([take.takeId, 0], [take.takeId, Number.MAX_SAFE_INTEGER])
  const chunks = await quietly(run<Blob[]>([CHUNKS], "readonly", (tx) => tx.objectStore(CHUNKS).getAll(range)))
  if (!chunks?.length) return null
  return { take, blob: new Blob(chunks, { type: take.mime }), chunks: chunks.length }
}

export async function clearTake(): Promise<void> {
  const take = await quietly(run<StoredTake>([TAKES], "readonly", (tx) => tx.objectStore(TAKES).get(OWNER)))
  if (!take) return
  const range = IDBKeyRange.bound([take.takeId, 0], [take.takeId, Number.MAX_SAFE_INTEGER])
  await quietly(
    run([TAKES, CHUNKS], "readwrite", (tx) => {
      tx.objectStore(CHUNKS).delete(range)
      tx.objectStore(TAKES).delete(OWNER)
    }),
  )
}

export function savePhoto(photo: Omit<StoredPhoto, "uid">): Promise<unknown> {
  return quietly(run([TAKES], "readwrite", (tx) => tx.objectStore(TAKES).put({ ...photo, uid: PHOTO })))
}

export async function loadPhoto(): Promise<Omit<StoredPhoto, "uid"> | null> {
  const photo = await quietly(run<StoredPhoto>([TAKES], "readonly", (tx) => tx.objectStore(TAKES).get(PHOTO)))
  return photo?.blob ? photo : null
}

export function clearPhoto(): Promise<unknown> {
  return quietly(run([TAKES], "readwrite", (tx) => tx.objectStore(TAKES).delete(PHOTO)))
}
