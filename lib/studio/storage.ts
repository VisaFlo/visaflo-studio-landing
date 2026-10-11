// Firebase Storage over REST with the caller's own ID token: the storage
// rules decide what each token may read or write, so no service account is
// needed on Vercel. Shared by the submission list and the sample pipeline.
export const BUCKET = "devdashboard-c9159-ca"
export const PROJECT_ID = "devdashboard-c9159"

// Local QA: the same Storage emulator the browser uploads to (see
// docs/studio-capture/README.md).
export function storageBase(): string {
  const host =
    process.env.NODE_ENV !== "production"
      ? (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST ?? process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST)
      : undefined
  return host ? `http://${host}:9199` : "https://firebasestorage.googleapis.com"
}

export class StorageError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`Storage responded ${status}: ${detail.slice(0, 300)}`)
  }
}

export type ObjectMeta = {
  name: string
  size?: string
  contentType?: string
  timeCreated?: string
  downloadTokens?: string
  metadata?: Record<string, string>
}

const objects = () => `${storageBase()}/v0/b/${BUCKET}/o`

export async function storageGet(token: string, path: string): Promise<Response> {
  const response = await fetch(`${objects()}${path}`, {
    headers: { Authorization: `Firebase ${token}` },
    cache: "no-store",
  })
  if (!response.ok) throw new StorageError(response.status, await response.text())
  return response
}

export async function storageJson<T>(token: string, objectName: string): Promise<T> {
  return (await storageGet(token, `/${encodeURIComponent(objectName)}?alt=media`)).json() as Promise<T>
}

export async function storageMeta(token: string, objectName: string): Promise<ObjectMeta> {
  return (await storageGet(token, `/${encodeURIComponent(objectName)}`)).json() as Promise<ObjectMeta>
}

export async function storageBytes(token: string, objectName: string): Promise<Uint8Array> {
  return new Uint8Array(await (await storageGet(token, `/${encodeURIComponent(objectName)}?alt=media`)).arrayBuffer())
}

// The same multipart body the Firebase SDK sends for uploadBytes, so the
// bucket treats it like a browser upload and mints a download token.
export function buildMultipart(
  objectName: string,
  body: Uint8Array | string,
  contentType: string,
  customMetadata?: Record<string, string>,
): { contentType: string; body: Uint8Array<ArrayBuffer> } {
  const boundary = `b${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  const meta = JSON.stringify({ name: objectName, contentType, ...(customMetadata ? { metadata: customMetadata } : {}) })
  const head = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
  )
  const file = typeof body === "string" ? new TextEncoder().encode(body) : body
  const tail = new TextEncoder().encode(`\r\n--${boundary}--`)
  // A plain ArrayBuffer-backed view, which is what fetch accepts as a body.
  const out = new Uint8Array(new ArrayBuffer(head.length + file.length + tail.length))
  out.set(head, 0)
  out.set(file, head.length)
  out.set(tail, head.length + file.length)
  return { contentType: `multipart/related; boundary=${boundary}`, body: out }
}

export async function storageUpload(
  token: string,
  objectName: string,
  body: Uint8Array | string,
  contentType: string,
  customMetadata?: Record<string, string>,
): Promise<ObjectMeta> {
  const part = buildMultipart(objectName, body, contentType, customMetadata)
  const response = await fetch(`${objects()}?name=${encodeURIComponent(objectName)}`, {
    method: "POST",
    headers: {
      Authorization: `Firebase ${token}`,
      "Content-Type": part.contentType,
      "X-Goog-Upload-Protocol": "multipart",
    },
    body: part.body,
  })
  if (!response.ok) throw new StorageError(response.status, await response.text())
  return (await response.json()) as ObjectMeta
}

export async function storageExists(token: string, objectName: string): Promise<boolean> {
  try {
    await storageMeta(token, objectName)
    return true
  } catch (error) {
    if (error instanceof StorageError && error.status === 404) return false
    throw error
  }
}

export type Listing = { prefixes: string[]; items: string[] }

// One folder level, the way the Firebase SDK lists: prefix plus "/" delimiter.
export async function listObjects(token: string, prefix: string): Promise<Listing> {
  const listing: Listing = { prefixes: [], items: [] }
  let pageToken: string | undefined
  do {
    const query = new URLSearchParams({ prefix, delimiter: "/", maxResults: "1000" })
    if (pageToken) query.set("pageToken", pageToken)
    const body = (await (await storageGet(token, `?${query}`)).json()) as {
      prefixes?: string[]
      items?: { name: string }[]
      nextPageToken?: string
    }
    listing.prefixes.push(...(body.prefixes ?? []))
    listing.items.push(...(body.items ?? []).map((item) => item.name))
    pageToken = body.nextPageToken
  } while (pageToken)
  return listing
}

export function mediaUrl(objectName: string, downloadToken: string): string {
  return `${objects()}/${encodeURIComponent(objectName)}?alt=media&token=${downloadToken}`
}

export function consoleUrl(folder: string): string {
  return `https://console.firebase.google.com/project/${PROJECT_ID}/storage/${BUCKET}/files/~2F${folder.split("/").join("~2F")}`
}
