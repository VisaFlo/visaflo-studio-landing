// Small formatters shared by the admin list and the submission page.
export function when(iso?: string): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return "—"
  return new Date(iso).toLocaleString("en-CA", { timeZone: "America/Vancouver", dateStyle: "medium", timeStyle: "short" })
}

export function clipLength(seconds?: number): string {
  if (!seconds) return "—"
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds) % 60).padStart(2, "0")}`
}

export function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function submissionHref(id: string): string {
  return `/admin/${id}`
}
