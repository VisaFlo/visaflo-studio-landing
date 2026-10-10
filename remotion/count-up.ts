// A big number runs up to its value as the card lands, like the samples'
// "2,000". Below 100 it isn't worth it; text stays as it is.
export function countUp(value: string, progress: number): string {
  const m = /\d[\d,]*/.exec(value)
  if (!m) return value
  const target = Number(m[0].replace(/,/g, ""))
  if (!Number.isFinite(target) || target < 100 || progress >= 1) return value
  const eased = 1 - Math.pow(1 - Math.max(0, progress), 3)
  const now = Math.round(target * (0.05 + 0.95 * eased))
  const grouped = m[0].includes(",") ? now.toLocaleString("en-US") : String(now)
  return value.slice(0, m.index) + grouped + value.slice(m.index + m[0].length)
}
