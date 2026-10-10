import type { LipsyncModel, Method } from "@/lib/studio/sample/status"

// Public list prices on 2026-10-09 (see the spec). Only this file knows them,
// so status.json totals stay comparable when a price moves.
export const PRICES = {
  seedancePerSecond: 0.144, // sale; list is 0.2057
  lipsyncPerMinute: { standard: 3, pro: 5 },
  omnihumanPerSecond: 0.16,
  ttsPer1kChars: 0.08,
  musicPerMinute: 0.15,
  sfxPerGeneration: 0.12,
  scriptCall: 0.1,
  lambdaRender: 0.02,
}

export const round2 = (n: number) => Math.round(n * 100) / 100

export function videoCost(method: Method, seconds: number, lipsync: LipsyncModel = "pro"): number {
  const lipsyncCost = (seconds / 60) * PRICES.lipsyncPerMinute[lipsync]
  if (method === "real") return round2(lipsyncCost)
  if (method === "scene") return round2(seconds * PRICES.seedancePerSecond + lipsyncCost)
  return round2(seconds * PRICES.omnihumanPerSecond)
}

export function audioCost(speechSeconds: number): number {
  return round2(((speechSeconds + 3) / 60) * PRICES.musicPerMinute + 2 * PRICES.sfxPerGeneration)
}

export function ttsCost(chars: number): number {
  return Math.round((chars / 1000) * PRICES.ttsPer1kChars * 1000) / 1000
}
