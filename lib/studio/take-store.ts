"use client"

// Keeps the current take in IndexedDB while it records (one-second chunks),
// so a reload, a closed tab or a crashed browser doesn't throw away a minute
// of reading. One take per account; it's cleared once the request is sent or
// the person starts over.

const DB_NAME = "vf-studio"
const TAKES = "takes"
const CHUNKS = "chunks"

export type StoredTake = {
  uid: string
  takeId: string
  mime: string
  source: "camera" | "upload"
  startedAt: number
  /** Set when the person pressed Finish (or picked a file); absent if cut off. */
  finished?: { seconds: number; checks?: { faceSeen: boolean; voiceHeard: boolean } }
}

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

export function beginTake(take: StoredTake): Promise<unknown> {
  return quietly(
    clearTake(take.uid).then(() => run([TAKES], "readwrite", (tx) => tx.objectStore(TAKES).put(take))),
  )
}

export function saveChunk(takeId: string, index: number, chunk: Blob): Promise<unknown> {
  return quietly(run([CHUNKS], "readwrite", (tx) => tx.objectStore(CHUNKS).put(chunk, [takeId, index])))
}

export function finishTake(uid: string, finished: NonNullable<StoredTake["finished"]>): Promise<unknown> {
  return quietly(
    run<StoredTake>([TAKES], "readonly", (tx) => tx.objectStore(TAKES).get(uid)).then((take) =>
      take ? run([TAKES], "readwrite", (tx) => tx.objectStore(TAKES).put({ ...take, finished })) : undefined,
    ),
  )
}

export async function loadTake(uid: string): Promise<{ take: StoredTake; blob: Blob; chunks: number } | null> {
  const take = await quietly(run<StoredTake>([TAKES], "readonly", (tx) => tx.objectStore(TAKES).get(uid)))
  if (!take) return null
  const range = IDBKeyRange.bound([take.takeId, 0], [take.takeId, Number.MAX_SAFE_INTEGER])
  const chunks = await quietly(run<Blob[]>([CHUNKS], "readonly", (tx) => tx.objectStore(CHUNKS).getAll(range)))
  if (!chunks?.length) return null
  return { take, blob: new Blob(chunks, { type: take.mime }), chunks: chunks.length }
}

export async function clearTake(uid: string): Promise<void> {
  const take = await quietly(run<StoredTake>([TAKES], "readonly", (tx) => tx.objectStore(TAKES).get(uid)))
  if (!take) return
  const range = IDBKeyRange.bound([take.takeId, 0], [take.takeId, Number.MAX_SAFE_INTEGER])
  await quietly(
    run([TAKES, CHUNKS], "readwrite", (tx) => {
      tx.objectStore(CHUNKS).delete(range)
      tx.objectStore(TAKES).delete(uid)
    }),
  )
}
